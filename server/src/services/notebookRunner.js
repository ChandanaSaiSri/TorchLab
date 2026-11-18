import crypto from 'node:crypto';

export const MAX_CELLS = 30;
export const MAX_CELL_CHARS = 20000;
export const MAX_TOTAL_CHARS = 30000; // the runner accepts 40k of program text and escaping adds some

export const joinCells = (cells) => cells.join('\n\n# %%\n');

/**
 * A notebook is run like a restarted kernel: cells 1..k execute in one Python process, sharing variables.
 * Each cell is exec'd under its own file name (<cell 2>) so a traceback points at the right cell and line,
 * and a marker line is printed before each cell so its output can be cut out of the combined stdout.
 */
export function composeCells(cells, upTo, nonce = crypto.randomBytes(8).toString('hex')) {
  const run = cells.slice(0, upTo + 1);
  const program = `import linecache as __lc, sys as __sys, traceback as __tb
__cells = ${JSON.stringify(run)}
for __i, __src in enumerate(__cells):
    print("\\n@@TL${nonce}:%d" % __i, flush=True)
    __name = "<cell %d>" % (__i + 1)
    __lc.cache[__name] = (len(__src), None, __src.splitlines(True), __name)
    try:
        exec(compile(__src, __name, "exec"), globals())
    except SystemExit:
        break
    except BaseException as __e:
        __sys.stdout.flush()
        __frames = __e.__traceback__.tb_next  # drop this wrapper's own frame
        print("Traceback (most recent call last):", file=__sys.stderr)
        for __line in __tb.format_list(__tb.extract_tb(__frames)) + __tb.format_exception_only(type(__e), __e):
            print(__line, end="", file=__sys.stderr)
        __sys.exit(1)
`;
  return { program, nonce };
}

/** Split the combined stdout back into one output per cell. */
export function splitOutputs(stdout, nonce, count) {
  const outputs = Array.from({ length: count }, () => null);
  const re = new RegExp(`\\n@@TL${nonce}:(\\d+)\\n`, 'g');
  const marks = [...String(stdout || '').matchAll(re)];
  marks.forEach((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : String(stdout).length;
    const idx = Number(m[1]);
    if (idx < count) outputs[idx] = String(stdout).slice(start, end);
  });
  const last = marks.length ? Number(marks[marks.length - 1][1]) : -1;
  return { outputs, lastCell: last };
}

export function checkCells(cells) {
  if (!Array.isArray(cells) || cells.length < 1 || cells.length > MAX_CELLS) return `A notebook needs 1 to ${MAX_CELLS} cells`;
  if (cells.some((c) => typeof c !== 'string' || c.length > MAX_CELL_CHARS)) return `Each cell can hold up to ${MAX_CELL_CHARS} characters`;
  if (cells.reduce((n, c) => n + c.length, 0) > MAX_TOTAL_CHARS) return `A notebook can hold up to ${MAX_TOTAL_CHARS} characters in total`;
  return null;
}
