/**
 * Reading a password from the terminal without it being visible or recoverable.
 *
 * The requirement this serves is explicit in the brief: the admin password must
 * not be in source code, git, a seed file, or frontend code. So the only place
 * it may be typed is an interactive prompt, and the ways that leaks are worth
 * enumerating, because each one is a separate mistake:
 *
 *   * **Echoed to the screen** — shoulder-surfing, and worse, screen recordings
 *     and pair-programming sessions. Hence raw mode with no echo.
 *   * **A command-line argument** — visible in `ps` to every user on the machine
 *     and written to shell history. Hence no `--password` flag anywhere.
 *   * **An environment variable** — inherited by every child process and often
 *     printed by CI logs. Hence not that either.
 *   * **A file** — needs deleting, and `.env.local` is one careless `git add -f`
 *     from being committed.
 *
 * Typed into a prompt and passed in memory to bcrypt is the only path that
 * avoids all four.
 */

import readline from 'node:readline';

/** Plain visible prompt, for non-secret answers. */
export function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Reads a line without echoing it.
 *
 * Raw mode is handled by hand rather than with a library: the whole behaviour is
 * forty lines, and a dependency that touches the password is a dependency whose
 * every future version touches the password.
 *
 * Ctrl-C is handled explicitly. Without it, raw mode swallows the interrupt and
 * the terminal is left with echo disabled — the user's shell appears broken and
 * they have to run `reset` to fix it.
 */
export function askHidden(question) {
  if (!process.stdin.isTTY) {
    return Promise.reject(
      new Error(
        'A password can only be entered interactively. Run this in a terminal, not through a pipe or a CI job.'
      )
    );
  }

  return new Promise((resolve, reject) => {
    process.stdout.write(question);

    const { stdin } = process;
    const wasRaw = stdin.isRaw;

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';

    const restore = () => {
      stdin.setRawMode(Boolean(wasRaw));
      stdin.removeListener('data', onData);
      stdin.pause();
    };

    const onData = (chunk) => {
      for (const char of chunk) {
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004': // Ctrl-D (end of input)
            restore();
            process.stdout.write('\n');
            resolve(value);
            return;

          case '\u0003': // Ctrl-C
            restore();
            process.stdout.write('\n');
            reject(new Error('Cancelled.'));
            return;

          case '\u007f': // Backspace (DEL)
          case '\b':
            value = value.slice(0, -1);
            break;

          default:
            // Ignore the remaining control characters rather than storing them:
            // an arrow key would otherwise insert an escape sequence into the
            // password, which the user cannot see and cannot reproduce later.
            if (char >= ' ' && char !== '\u007f') value += char;
        }
      }
    };

    stdin.on('data', onData);
  });
}

/**
 * Asks twice and requires a match.
 *
 * With no echo there is no way to check what was typed, and a typo in a password
 * you cannot see means being locked out of your own dashboard with no way to
 * find out why.
 */
export async function askNewPassword() {
  const first = await askHidden('New password (not shown): ');
  const second = await askHidden('Confirm password: ');

  if (first !== second) {
    throw new Error('The two passwords did not match. Nothing was changed — run this again.');
  }

  return first;
}
