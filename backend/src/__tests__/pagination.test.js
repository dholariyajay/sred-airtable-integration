const axios = require('axios');
const { fetchAllPaginated } = require('../utils/pagination');

jest.mock('axios');

describe('pagination utility', () => {
  afterEach(() => jest.clearAllMocks());

  it('single page (no offset)', async () => {
    axios.get.mockResolvedValueOnce({
      data: { records: [{ id: 'r1' }, { id: 'r2' }] }
    });

    const result = await fetchAllPaginated('https://api.airtable.com/v0/app1/tbl1', 'token123', 'records');

    expect(result).toHaveLength(2);
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.airtable.com/v0/app1/tbl1',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token123' }
      })
    );
  });

  it('follows offset across pages', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: { records: [{ id: 'r1' }], offset: 'page2' }
      })
      .mockResolvedValueOnce({
        data: { records: [{ id: 'r2' }], offset: 'page3' }
      })
      .mockResolvedValueOnce({
        data: { records: [{ id: 'r3' }] }
      });

    const result = await fetchAllPaginated('https://api.airtable.com/v0/app1/tbl1', 'tok', 'records');

    expect(result).toHaveLength(3);
    expect(result.map(r => r.id)).toEqual(['r1', 'r2', 'r3']);
    expect(axios.get).toHaveBeenCalledTimes(3);

    const secondCallParams = axios.get.mock.calls[1][1].params;
    expect(secondCallParams.offset).toBe('page2');
  });

  it('empty when key missing from response', async () => {
    axios.get.mockResolvedValueOnce({ data: {} });

    const result = await fetchAllPaginated('https://api.airtable.com/v0/test', 'tok', 'bases');
    expect(result).toEqual([]);
  });

  it('passes extra params through', async () => {
    axios.get.mockResolvedValueOnce({
      data: { records: [{ id: 'r1' }] }
    });

    await fetchAllPaginated('https://api.airtable.com/v0/app1/tbl1', 'tok', 'records', { pageSize: 50 });

    expect(axios.get.mock.calls[0][1].params).toEqual(
      expect.objectContaining({ pageSize: 50 })
    );
  });

  it('prepends base URL for relative endpoints', async () => {
    axios.get.mockResolvedValueOnce({ data: { bases: [] } });

    await fetchAllPaginated('meta/bases', 'tok', 'bases');

    expect(axios.get.mock.calls[0][0]).toContain('https://api.airtable.com/v0/meta/bases');
  });

  it('throws on API error', async () => {
    axios.get.mockRejectedValueOnce(new Error('rate limited'));

    await expect(
      fetchAllPaginated('https://api.airtable.com/v0/test', 'tok', 'records')
    ).rejects.toThrow('rate limited');
  });
});
