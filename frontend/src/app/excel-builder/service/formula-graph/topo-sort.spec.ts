import { topoSort, collectAffected } from './topo-sort';
import { CellKey } from './types';

/** Build forward map từ adjacency list. */
function build(adj: Record<string, string[]>): Map<CellKey, Set<CellKey>> {
  const m = new Map<CellKey, Set<CellKey>>();
  for (const [node, deps] of Object.entries(adj)) {
    m.set(node, new Set(deps));
  }
  return m;
}

describe('formula-graph/topo-sort', () => {
  describe('topoSort', () => {
    it('linear DAG: A → B → C (A depends on B depends on C) sorts deps-first', () => {
      const forward = build({
        A: ['B'],
        B: ['C'],
        C: [],
      });
      const { order, cycles } = topoSort(forward);
      expect(cycles).toEqual([]);
      expect(order.indexOf('C')).toBeLessThan(order.indexOf('B'));
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('A'));
    });

    it('diamond DAG: D depends on B+C, both depend on A', () => {
      const forward = build({
        A: [],
        B: ['A'],
        C: ['A'],
        D: ['B', 'C'],
      });
      const { order, cycles } = topoSort(forward);
      expect(cycles).toEqual([]);
      expect(order.length).toBe(4);
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('C'));
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('D'));
      expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'));
    });

    it('self-loop: A → A detected as cycle of size 1', () => {
      const forward = build({ A: ['A'] });
      const { order, cycles } = topoSort(forward);
      expect(order).toEqual([]);
      expect(cycles.length).toBe(1);
      expect(cycles[0]).toEqual(['A']);
    });

    it('2-cycle: A↔B detected together', () => {
      const forward = build({
        A: ['B'],
        B: ['A'],
      });
      const { order, cycles } = topoSort(forward);
      expect(order).toEqual([]);
      expect(cycles.length).toBe(1);
      expect(cycles[0].sort()).toEqual(['A', 'B']);
    });

    it('REGRESSION Phase 3: downstream of cycle still in `order`', () => {
      // C → B → A → B (cycle: A↔B). D depends on C (downstream).
      // Old version: D stuck behind cycle → order missing D → 155 cells blank.
      // Phase 3 fix: cycle members marked, dependents continue Kahn's.
      const forward = build({
        A: ['B'],
        B: ['A'],
        C: ['B'],
        D: ['C'],
      });
      const { order, cycles } = topoSort(forward);
      expect(cycles.length).toBe(1);
      // C and D should be in order despite being downstream of cycle
      expect(order).toContain('C');
      expect(order).toContain('D');
      // Topo correctness preserved for non-cycle parts
      expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'));
    });

    it('ignores deps that are not formula nodes (raw data leaves)', () => {
      // X = raw data cell (not in forward keys). A depends on X + B.
      const forward = build({
        A: ['X', 'B'],
        B: [],
      });
      const { order } = topoSort(forward);
      // X not counted in inDegree → A starts at deg 1, becomes 0 after B
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('A'));
    });

    it('disconnected components both sorted', () => {
      const forward = build({
        A: ['B'],
        B: [],
        X: ['Y'],
        Y: [],
      });
      const { order, cycles } = topoSort(forward);
      expect(cycles).toEqual([]);
      expect(order.length).toBe(4);
    });
  });

  describe('collectAffected', () => {
    it('BFS reverse-deps from seeds', () => {
      // Reverse map: dep → dependents
      const reverse = new Map<CellKey, Set<CellKey>>([
        ['A', new Set(['B', 'C'])],
        ['B', new Set(['D'])],
        ['C', new Set(['D'])],
      ]);
      const affected = collectAffected(reverse, ['A']);
      expect(Array.from(affected).sort()).toEqual(['B', 'C', 'D']);
    });

    it('does NOT include seeds themselves', () => {
      const reverse = new Map<CellKey, Set<CellKey>>([
        ['A', new Set(['B'])],
      ]);
      const affected = collectAffected(reverse, ['A']);
      expect(affected.has('A')).toBe(false);
      expect(affected.has('B')).toBe(true);
    });

    it('handles seed with no dependents', () => {
      const reverse = new Map<CellKey, Set<CellKey>>();
      const affected = collectAffected(reverse, ['A']);
      expect(affected.size).toBe(0);
    });
  });
});
