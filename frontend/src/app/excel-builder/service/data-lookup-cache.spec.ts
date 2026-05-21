/**
 * Bug 2 regression: cache `DataLookupService` phải refetch khi columns request thay đổi.
 *
 * Trước fix: cache key chỉ gồm `templateCode_year_month_orgCode`. User sửa formula
 * `LOOKUP("BC01","r1","wrongCol","N")` → `correctCol` → cache hit response cũ
 * (rows chỉ có `row_code`, BE filter loại bỏ keys không tồn tại) → eval `correctCol in row`
 * = false → false `#NOCOL!`. F5 fix vì cache empty → fetch fresh với column đúng.
 *
 * Sau fix: cache track `fetchedColumns: Set<string>`. Cache hit chỉ khi req.columns ⊆ fetched.
 * Refetch với UNION (cached ∪ new) để cache "growing" đúng.
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DataLookupService, LookupParams, LookupResponse } from './data-lookup.service';

describe('DataLookupService — Bug 2: cache columns-aware', () => {
  let service: DataLookupService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DataLookupService],
    });
    service = TestBed.inject(DataLookupService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function envelope<T>(data: T) {
    return { code: '0', message: 'OK', data };
  }

  function batchUrl() {
    return '/excelpro-service/v1/data-lookup/batch';
  }

  it('first request fetches uncached params + caches with fetchedColumns', () => {
    const req: LookupParams = {
      templateCode: 'BC01',
      year: 2026,
      month: null,
      columns: ['colA'],
    };

    let received: LookupResponse[] | null = null;
    service.batchLookup([req]).subscribe((r) => (received = r));

    const httpReq = http.expectOne(batchUrl());
    expect(httpReq.request.body.requests[0].columns).toEqual(['colA']);

    httpReq.flush(
      envelope([
        {
          templateCode: 'BC01',
          year: 2026,
          month: null,
          orgCode: null,
          rows: [{ row_code: 'r1', colA: 100 }],
          templateExists: true,
        },
      ]),
    );

    expect(received).toBeTruthy();
    expect(received![0].rows[0]['colA']).toBe(100);
  });

  it('cache hit: identical columns → no HTTP', () => {
    const req: LookupParams = {
      templateCode: 'BC01',
      year: 2026,
      month: null,
      columns: ['colA'],
    };

    service.batchLookup([req]).subscribe();
    http.expectOne(batchUrl()).flush(
      envelope([
        {
          templateCode: 'BC01',
          year: 2026,
          month: null,
          orgCode: null,
          rows: [{ row_code: 'r1', colA: 1 }],
          templateExists: true,
        },
      ]),
    );

    // 2nd identical request → no HTTP call
    let cacheHit: LookupResponse[] | null = null;
    service.batchLookup([req]).subscribe((r) => (cacheHit = r));
    http.expectNone(batchUrl());
    expect(cacheHit).toBeTruthy();
    expect(cacheHit![0].rows[0]['colA']).toBe(1);
  });

  it('cache hit subset: requesting subset of fetched columns → no HTTP', () => {
    service
      .batchLookup([
        { templateCode: 'BC01', year: 2026, month: null, columns: ['colA', 'colB'] },
      ])
      .subscribe();
    http.expectOne(batchUrl()).flush(
      envelope([
        {
          templateCode: 'BC01',
          year: 2026,
          month: null,
          orgCode: null,
          rows: [{ row_code: 'r1', colA: 1, colB: 2 }],
          templateExists: true,
        },
      ]),
    );

    let result: LookupResponse[] | null = null;
    service
      .batchLookup([{ templateCode: 'BC01', year: 2026, month: null, columns: ['colA'] }])
      .subscribe((r) => (result = r));
    http.expectNone(batchUrl());
    expect(result![0].rows[0]['colA']).toBe(1);
  });

  it('Bug 2 fix: new column NOT in cache → refetch with UNION columns', () => {
    // 1st: fetch wrongCol (ban đầu user nhập formula sai column)
    service
      .batchLookup([
        { templateCode: 'BC01', year: 2026, month: null, columns: ['wrongCol'] },
      ])
      .subscribe();
    http.expectOne(batchUrl()).flush(
      envelope([
        {
          templateCode: 'BC01',
          year: 2026,
          month: null,
          orgCode: null,
          // BE filter projectColumns: chỉ giữ row_code (wrongCol không tồn tại trong template)
          rows: [{ row_code: 'r1' }],
          templateExists: true,
        },
      ]),
    );

    // Eval lookup với wrongCol → #NOCOL! (đúng)
    expect(service.getCachedLookup('BC01', 2026, null, null)?.rows[0]['wrongCol']).toBeUndefined();

    // 2nd: user sửa formula → correctCol. Phải refetch (KHÔNG được cache hit response cũ).
    service
      .batchLookup([
        { templateCode: 'BC01', year: 2026, month: null, columns: ['correctCol'] },
      ])
      .subscribe();

    const refetch = http.expectOne(batchUrl());
    // Refetch UNION columns: ['wrongCol', 'correctCol'] → BE biết template có correctCol thật, trả về
    expect(refetch.request.body.requests[0].columns).toContain('correctCol');
    expect(refetch.request.body.requests[0].columns).toContain('wrongCol');

    refetch.flush(
      envelope([
        {
          templateCode: 'BC01',
          year: 2026,
          month: null,
          orgCode: null,
          rows: [{ row_code: 'r1', correctCol: 42 }],
          templateExists: true,
        },
      ]),
    );

    // Cache giờ có correctCol → eval lookup với correctCol = 42, không còn #NOCOL!
    const cached = service.getCachedLookup('BC01', 2026, null, null);
    expect(cached?.rows[0]['correctCol']).toBe(42);
  });

  it('cache survives invalidate', () => {
    service
      .batchLookup([{ templateCode: 'BC01', year: 2026, month: null, columns: ['a'] }])
      .subscribe();
    http.expectOne(batchUrl()).flush(
      envelope([
        {
          templateCode: 'BC01',
          year: 2026,
          month: null,
          orgCode: null,
          rows: [{ row_code: 'r1', a: 1 }],
          templateExists: true,
        },
      ]),
    );

    expect(service.getCachedLookup('BC01', 2026, null, null)).toBeTruthy();
    service.invalidateCache();
    expect(service.getCachedLookup('BC01', 2026, null, null)).toBeUndefined();
  });

  it('templateExists=false propagates to cache + getCachedLookup', () => {
    service
      .batchLookup([{ templateCode: 'WRONG', year: 2026, month: null, columns: ['a'] }])
      .subscribe();
    http.expectOne(batchUrl()).flush(
      envelope([
        {
          templateCode: 'WRONG',
          year: 2026,
          month: null,
          orgCode: null,
          rows: [],
          templateExists: false,
        },
      ]),
    );

    const cached = service.getCachedLookup('WRONG', 2026, null, null);
    expect(cached?.templateExists).toBe(false);
  });
});
