# Norc

Yet another cron-ish job scheduler for Deno and the browser.

## Use

```js
import {Scheduler} from './norc.js';

const s = new Scheduler();
s.start();
const {ok, result, error} = s.scheduleFn('* * * * * *', (date) => console.log('hi!', date));
// ...
s.unschedule(result);
s.stop();
```

## Test

```sh
deno test tests.js
```

## License

MIT
