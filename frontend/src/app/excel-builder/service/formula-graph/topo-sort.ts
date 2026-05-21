/**
 * Topological sort + cycle detection cho formula DAG.
 *
 * - Kahn's algorithm: O(V+E), trả về order nếu DAG.
 * - Cycle còn lại sau Kahn → Tarjan SCC để liệt kê thành phần liên thông mạnh
 *   (mỗi cycle là 1 SCC có size > 1 hoặc 1 self-loop).
 *
 * Forward map: cell → set deps (cells mà cell này phụ thuộc).
 * Reverse map: cell → set dependents (cells phụ thuộc cell này).
 *
 * Để topo sort đúng "deps trước dependents sau", trả order theo chiều "leaf → root":
 * cells không có deps trước, cells có deps đợi deps eval xong.
 */

import { CellKey } from './types';

export interface TopoSortResult {
  /** Order theo chiều deps-first → eval theo thứ tự này đảm bảo deps đã có giá trị. */
  order: CellKey[];
  /** Mỗi entry là 1 cycle (set cellKeys). Cells này KHÔNG có trong order. */
  cycles: CellKey[][];
}

/**
 * Kahn's algorithm + cycle handling.
 *
 * Phase 1: Kahn's pop nodes có inDegree=0 → `order` (cells eval bình thường).
 * Phase 2: Nodes còn inDegree>0 → "stuck" (trong cycle hoặc downstream của cycle).
 *   - Tarjan SCC trên subgraph stuck → liệt kê cycles cụ thể.
 *   - Mark cycle members là "đã eval" (caller set shadow = #CIRCULAR!).
 *   - Decrement dependents' inDegree → nodes downstream của cycle có thể pop tiếp.
 * Phase 3: Continue Kahn → append downstream cells vào `order`. Khi eval các cells
 *   này, shadowReader đọc CIRCULAR từ deps trong cycle → propagate (sẽ toNumericString
 *   = 0 trong eval, nhưng cell vẫn có shadow value, không blank).
 *
 * → Mọi formula cells (266 cells) đều có shadow entry sau eval, không có cell blank.
 */
export function topoSort(forward: Map<CellKey, Set<CellKey>>): TopoSortResult {
  // Build inDegree từ forward (node có deps nào → inDegree = số deps)
  const inDegree = new Map<CellKey, number>();
  // Build reverse để decrement đúng cells phụ thuộc
  const reverse = new Map<CellKey, Set<CellKey>>();
  for (const [node, deps] of forward) {
    if (!inDegree.has(node)) inDegree.set(node, 0);
    for (const dep of deps) {
      // Chỉ count dep nếu dep cũng là formula node (có trong forward).
      // Raw data cells không có forward entry → bỏ qua (chúng là leaves vô hạn).
      if (forward.has(dep)) {
        inDegree.set(node, (inDegree.get(node) ?? 0) + 1);
        if (!reverse.has(dep)) reverse.set(dep, new Set());
        reverse.get(dep)!.add(node);
      }
    }
  }

  // Phase 1: Kahn's algorithm
  const queue: CellKey[] = [];
  for (const [node, deg] of inDegree) {
    if (deg === 0) queue.push(node);
  }

  const order: CellKey[] = [];
  const popOne = (node: CellKey) => {
    order.push(node);
    const dependents = reverse.get(node);
    if (!dependents) return;
    for (const dep of dependents) {
      const newDeg = (inDegree.get(dep) ?? 0) - 1;
      inDegree.set(dep, newDeg);
      if (newDeg === 0) queue.push(dep);
    }
  };

  while (queue.length > 0) {
    popOne(queue.shift()!);
  }

  // Phase 2: stuck nodes (inDegree > 0 = cycle hoặc downstream của cycle)
  const cycleNodes = new Set<CellKey>();
  for (const [node, deg] of inDegree) {
    if (deg > 0) cycleNodes.add(node);
  }

  if (cycleNodes.size === 0) {
    return { order, cycles: [] };
  }

  // Tarjan SCC trên subgraph stuck → liệt kê cycles cụ thể
  const subForward = new Map<CellKey, Set<CellKey>>();
  for (const node of cycleNodes) {
    const deps = forward.get(node);
    if (!deps) continue;
    const filtered = new Set<CellKey>();
    for (const d of deps) if (cycleNodes.has(d)) filtered.add(d);
    subForward.set(node, filtered);
  }

  const cycles = tarjanSCC(subForward).filter(scc => scc.length > 1 || hasSelfLoop(scc[0], subForward));

  // Phase 3: Treat cycle members như đã eval, decrement dependents → unblock downstream
  const cycleMembers = new Set<CellKey>();
  for (const cycle of cycles) for (const k of cycle) cycleMembers.add(k);

  // Set inDegree của cycle members về -1 sentinel (đã "eval", không pop nữa).
  for (const member of cycleMembers) inDegree.set(member, -1);

  // Decrement: với mỗi cycle member, các dependents giảm inDegree (như nếu member đã pop).
  for (const member of cycleMembers) {
    const dependents = reverse.get(member);
    if (!dependents) continue;
    for (const dep of dependents) {
      // Skip dependents là cycle members (cùng cycle hoặc cycle khác)
      if (cycleMembers.has(dep)) continue;
      const newDeg = (inDegree.get(dep) ?? 0) - 1;
      inDegree.set(dep, newDeg);
      if (newDeg === 0) queue.push(dep);
    }
  }

  // Continue Kahn cho downstream
  while (queue.length > 0) {
    popOne(queue.shift()!);
  }

  return { order, cycles };
}

function hasSelfLoop(node: CellKey, forward: Map<CellKey, Set<CellKey>>): boolean {
  return forward.get(node)?.has(node) ?? false;
}

/**
 * Tarjan's strongly connected components. Iterative để tránh stack overflow trên graph lớn.
 */
function tarjanSCC(forward: Map<CellKey, Set<CellKey>>): CellKey[][] {
  let index = 0;
  const indices = new Map<CellKey, number>();
  const lowlink = new Map<CellKey, number>();
  const onStack = new Set<CellKey>();
  const stack: CellKey[] = [];
  const result: CellKey[][] = [];

  // Iterative DFS state: { node, neighbours iterator, returnState }
  type Frame = { node: CellKey; iter: Iterator<CellKey>; pendingChild: CellKey | null };
  const callStack: Frame[] = [];

  for (const node of forward.keys()) {
    if (indices.has(node)) continue;

    callStack.push({
      node,
      iter: (forward.get(node) ?? new Set()).values(),
      pendingChild: null,
    });
    indices.set(node, index);
    lowlink.set(node, index);
    index++;
    stack.push(node);
    onStack.add(node);

    while (callStack.length > 0) {
      const frame = callStack[callStack.length - 1];

      if (frame.pendingChild) {
        // Vừa quay từ recursive call cho pendingChild → update lowlink
        lowlink.set(frame.node, Math.min(lowlink.get(frame.node)!, lowlink.get(frame.pendingChild)!));
        frame.pendingChild = null;
      }

      const next = frame.iter.next();
      if (next.done) {
        // Pop frame, check root SCC
        if (lowlink.get(frame.node) === indices.get(frame.node)) {
          const scc: CellKey[] = [];
          let popped: CellKey;
          do {
            popped = stack.pop()!;
            onStack.delete(popped);
            scc.push(popped);
          } while (popped !== frame.node);
          result.push(scc);
        }
        callStack.pop();
        continue;
      }

      const child = next.value;
      if (!indices.has(child)) {
        indices.set(child, index);
        lowlink.set(child, index);
        index++;
        stack.push(child);
        onStack.add(child);
        frame.pendingChild = child;
        callStack.push({
          node: child,
          iter: (forward.get(child) ?? new Set()).values(),
          pendingChild: null,
        });
      } else if (onStack.has(child)) {
        lowlink.set(frame.node, Math.min(lowlink.get(frame.node)!, indices.get(child)!));
      }
    }
  }

  return result;
}

/** BFS từ tập seed cells qua reverse map → tập tất cả dependents (transitive). */
export function collectAffected(
  reverse: Map<CellKey, Set<CellKey>>,
  seeds: CellKey[],
): Set<CellKey> {
  const visited = new Set<CellKey>();
  const queue = [...seeds];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const dependents = reverse.get(cur);
    if (!dependents) continue;
    for (const d of dependents) {
      if (visited.has(d)) continue;
      visited.add(d);
      queue.push(d);
    }
  }
  return visited;
}
