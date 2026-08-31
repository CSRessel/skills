export default {
  title: 'SQLite',
  subtitle: 'One SELECT, inside one process',

  // Regions group responsibilities, not separate services.
  zones: [
    { id: 'prepare', label: 'PREPARE SQL', x: 0, y: 8, w: 16, d: 12 },
    { id: 'execute', label: 'RUN BYTECODE', x: 18, y: 4, w: 10, d: 14 },
    { id: 'storage', label: 'READ PAGES', x: 30, y: 0, w: 16, d: 19 },
  ],

  // x/y place the footprint; w/d size it; h sets its height.
  // Omit shape for a box. Use another shape only when it adds meaning.
  nodes: [
    {
      id: 'app', zone: 'prepare', code: 'A', name: 'application',
      summary: 'Calls SQLite in-process: prepare SQL, step through rows, '
        + 'read column values, then finalize. The SQLite shell is one caller.',
      x: 1.5, y: 15, w: 3, d: 3, h: 2.4,
      files: ['src/shell.c.in'],
    },
    {
      id: 'parser', zone: 'prepare', code: 'P', name: 'tokenizer + parser',
      summary: 'During preparation, the tokenizer feeds SQL tokens to the '
        + 'generated parser. Grammar actions invoke statement compilation.',
      x: 2, y: 9.5, w: 4, d: 3, h: 2,
      files: ['src/prepare.c', 'src/tokenize.c', 'src/parse.y'],
    },
    {
      id: 'planner', zone: 'prepare', code: 'G', name: 'planner + codegen',
      summary: 'Resolves the SELECT, chooses table or index access paths, '
        + 'and emits instructions. Planning and code generation are grouped here.',
      x: 10, y: 14, w: 4, d: 3, h: 2.8,
      files: ['src/select.c', 'src/where.c'],
    },
    {
      id: 'program', zone: 'execute', code: 'S', name: 'prepared statement',
      summary: 'A sqlite3_stmt holds the compiled bytecode and execution '
        + 'state in memory. The divided block represents instructions, not a queue.',
      x: 19.5, y: 6, w: 5, d: 2.5, h: .9, shape: 'stack',
      files: ['src/vdbeInt.h', 'src/vdbeaux.c'],
    },
    {
      id: 'vm', zone: 'execute', code: 'V', name: 'VDBE',
      summary: 'The bytecode engine runs when the caller invokes sqlite3_step. '
        + 'It works with registers and cursors, yielding a row, completion, or an error.',
      x: 22.5, y: 12, w: 4, d: 3, h: 4,
      files: ['src/vdbe.c', 'src/vdbeapi.c'],
    },
    {
      id: 'btree', zone: 'storage', code: 'B', name: 'B-tree cursors',
      summary: 'Seek and scan table or index records stored in database pages. '
        + 'This example follows an ordinary table read, not a virtual table.',
      x: 31.5, y: 12, w: 3.5, d: 3.5, h: 2.6,
      files: ['src/btree.c', 'src/btree.h'],
    },
    {
      id: 'pager', zone: 'storage', code: 'C', name: 'pager + cache',
      summary: 'Supplies pages from the cache or storage and coordinates '
        + 'transaction I/O. This trace follows a cache miss without WAL; '
        + 'writes and recovery are omitted.',
      x: 31.5, y: 3, w: 3.5, d: 3.5, h: 3.2,
      files: ['src/pager.c', 'src/pcache.c'],
    },
    {
      id: 'vfs', zone: 'storage', code: 'F', name: 'VFS',
      summary: 'Platform implementations open, read, and lock files through '
        + 'SQLite’s file interfaces. This example uses an ordinary read, '
        + 'not memory-mapped I/O.',
      x: 39, y: 3, w: 4, d: 3, h: 2,
      files: ['src/os.c', 'src/os_unix.c'],
    },
    {
      id: 'database', zone: 'storage', code: 'D', name: 'database file',
      summary: 'The main file holds table and index pages. It is a file, '
        + 'not a database server. Journal and WAL side files are not shown.',
      x: 39, y: 12, w: 4, d: 4, h: 2.2, shape: 'cylinder',
      files: ['src/btreeInt.h'],
    },
  ],

  edges: [
    { id: 'prepare', from: 'app', to: 'parser', kind: 'control', label: 'sqlite3_prepare_v2: SQL text' },
    { id: 'plan', from: 'parser', to: 'planner', kind: 'control', label: 'compile parsed SELECT' },
    { id: 'emit', from: 'planner', to: 'program', kind: 'data', label: 'emit bytecode' },
    { id: 'step', from: 'app', to: 'vm', kind: 'control', label: 'sqlite3_step' },
    { id: 'execute', from: 'program', to: 'vm', kind: 'data', label: 'bytecode instructions' },
    { id: 'seek', from: 'vm', to: 'btree', kind: 'control', label: 'seek or scan records' },
    { id: 'page', from: 'btree', to: 'pager', kind: 'data', label: 'request a page' },
    { id: 'read', from: 'pager', to: 'vfs', kind: 'control', label: 'read on cache miss' },
    { id: 'file', from: 'vfs', to: 'database', kind: 'store', label: 'read file bytes' },
    { id: 'row', from: 'vm', to: 'app', kind: 'data', label: 'SQLITE_ROW + column values' },
  ],

  // One successful read. Cache hits skip I/O; preparation may also read schema.
  flow: [
    ['prepare', 'The application prepares a SELECT. SQLite tokenizes and parses its SQL.'],
    ['plan', 'Compilation resolves the query and chooses how to access its records.'],
    ['emit', 'Code generation builds a prepared statement containing bytecode.'],
    ['step', 'The application calls sqlite3_step to start or resume execution.'],
    ['execute', 'The VDBE executes instructions from the prepared statement.'],
    ['seek', 'Cursor instructions seek or scan the table or index B-tree.'],
    ['page', 'The B-tree asks the pager for a page. Cached pages need no file read.'],
    ['read', 'On this cache miss, the pager requests a read through the VFS.'],
    ['file', 'The platform reads database bytes; the page returns through the storage layers.'],
    ['row', 'The VDBE yields SQLITE_ROW. The caller reads column values and steps again.'],
  ],
};
