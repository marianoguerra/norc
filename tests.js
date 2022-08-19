//@format
/*globals Deno*/
import {
  assertEquals,
  assertObjectMatch,
  assert
} from 'https://deno.land/std@0.152.0/testing/asserts.ts';
import {
  parse,
  Scheduler,
  Result,
  Constant,
  Interval,
  Range,
  Sequence,
  Wildcard,
  CronMatcher,
  DAY_OF_WEEK_TO_NUM,
  MONTH_TO_NUM
} from './norc.js';

function range(from, to, by) {
  by = by ?? 1;
  const r = [];
  for (let i = from; i <= to; i += by) {
    r.push(i);
  }
  return r;
}

function allMatch(values, matcher) {
  assert(values.every((v, _i, _) => matcher.matches(v)));
}

function matchesThisRaw(values, matcher, e, fn) {
  const r = values.filter((v, _i, _) => fn(matcher, v));
  assertEquals(
    r.length,
    e.length,
    `matchesThis length: ${r.length} === ${e.length}? ${JSON.stringify(
      r
    )}\n${JSON.stringify(e)}`
  );
  for (let i = 0; i < e.length; i++) {
    assertEquals(r[i], e[i], `matchesThis length: ${r} === ${e}?`);
  }
}

function matchesThis(values, matcher, e) {
  return matchesThisRaw(values, matcher, e, (matcher, v) => matcher.matches(v));
}

function matchesIntervalThis(values, matcher, by, e) {
  return matchesThisRaw(values, matcher, e, (matcher, v) =>
    matcher.matchesInterval(v, by)
  );
}

function matchesIntervalRangeThis(values, matcher, e) {
  return matchesThisRaw(values, matcher, e, (matcher, v) =>
    matcher.matchesIntervalRange(v)
  );
}

Deno.test('norc', () => {
  allMatch(range(0, 59), new Wildcard());
  matchesIntervalThis(range(0, 59), new Wildcard(), 5, range(0, 59, 5));
  matchesIntervalRangeThis(range(0, 59), new Wildcard(), range(0, 59));

  matchesThis(range(0, 59), new Constant(13), [13]);
  matchesIntervalThis(range(0, 59), new Constant(13), 1, range(13, 59));
  matchesIntervalRangeThis(range(0, 59), new Constant(13), range(13, 59));

  matchesThis(range(0, 59), new Range(7, 15), range(7, 15));
  matchesThis(range(0, 59), new Interval(new Wildcard(), 5), range(0, 59, 5));
  matchesThis(
    range(0, 59),
    new Interval(new Constant(13), 5),
    range(13, 59, 5)
  );
  matchesThis(range(0, 59), new Interval(new Range(0, 30), 5), range(0, 30, 5));
  matchesThis(
    range(0, 59),
    new Interval(new Range(13, 43), 5),
    range(13, 43, 5)
  );

  function s(...m) {
    return new Sequence(m);
  }

  allMatch(range(0, 59), s(new Wildcard()));
  allMatch(range(0, 59), s(new Wildcard(), new Constant(7)));
  allMatch(range(0, 59), s(new Wildcard(), new Constant(7), new Range(10, 20)));
  matchesThis(range(0, 59), s(new Constant(7)), [7]);
  matchesThis(range(0, 59), s(new Constant(7), new Constant(12)), [7, 12]);
  matchesThis(
    range(0, 59),
    s(new Constant(7), new Constant(12), new Range(20, 25)),
    [7, 12, ...range(20, 25)]
  );
});

function isSameCron(a, e) {
  const {result, error} = a;
  assertEquals(error, null);
  assert(result.isEqual(e));
}

function isError(expr, eError) {
  const {result, error} = parse(expr);
  assertEquals(result, null, expr + ' -> ' + eError);
  assertEquals(error, eError);
}

Deno.test('norc.parse', () => {
  function w() {
    return new Wildcard();
  }
  function c(v) {
    return new Constant(v);
  }
  function r(f, t) {
    return new Range(f, t);
  }
  function i(m, b) {
    return new Interval(m, b);
  }
  function s(...a) {
    return new Sequence(a);
  }

  isSameCron(
    parse('* * * * * *'),
    new CronMatcher(w(), w(), w(), w(), w(), w())
  );

  isSameCron(
    parse('9 * * * * *'),
    new CronMatcher(c(9), w(), w(), w(), w(), w())
  );

  isSameCron(
    parse('1 2 3 4 5 6'),
    new CronMatcher(c(1), c(2), c(3), c(4), c(5), c(6))
  );

  isSameCron(
    parse('1-5 * * * * *'),
    new CronMatcher(r(1, 5), w(), w(), w(), w(), w())
  );

  isSameCron(
    parse('1-5/2 * * * * *'),
    new CronMatcher(i(r(1, 5), 2), w(), w(), w(), w(), w())
  );

  isSameCron(
    parse('1,3,5 * * * * *'),
    new CronMatcher(s(c(1), c(3), c(5)), w(), w(), w(), w(), w())
  );
  isSameCron(
    parse('1,2-5,*/5,1/6,1-6/3 * * * * *'),
    new CronMatcher(
      s(c(1), r(2, 5), i(w(), 5), i(c(1), 6), i(r(1, 6), 3)),
      w(),
      w(),
      w(),
      w(),
      w()
    )
  );

  Object.entries(MONTH_TO_NUM).forEach(([month, number]) => {
    const expr = `* * * * ${month} *`;
    isSameCron(
      parse(expr),
      new CronMatcher(w(), w(), w(), w(), c(number), w())
    );
  });

  Object.entries(DAY_OF_WEEK_TO_NUM).forEach(([day, number]) => {
    const expr = `* * * * * ${day}`;
    isSameCron(
      parse(expr),
      new CronMatcher(w(), w(), w(), w(), w(), c(number))
    );
  });

  isSameCron(
    parse('* * * * * 7'),
    new CronMatcher(w(), w(), w(), w(), w(), c(0))
  );

  isSameCron(
    parse('* * * * * SUN'),
    new CronMatcher(w(), w(), w(), w(), w(), c(0))
  );

  isError('* * * * *', '6 values required');
  isError('-/ * * * * *', 'second: bad format');
  isError('/- * * * * *', 'second: bad format');
  isError('1-/ * * * * *', 'second: bad format');
  isError('-1/ * * * * *', 'second: bad format');
  isError('/1 * * * * *', 'second: bad format');
  isError('-1 * * * * *', 'second: bad format');
  isError('a * * * * *', 'second: bad format');
  isError('60 * * * * *', 'second: not in range');

  isError('* -1 * * * *', 'minute: bad format');
  isError('* a * * * *', 'minute: bad format');
  isError('* 60 * * * *', 'minute: not in range');

  isError('* * -1 * * *', 'hour: bad format');
  isError('* * a * * *', 'hour: bad format');
  isError('* * 24 * * *', 'hour: not in range');
  isError('* * * -1 * *', 'day of month: bad format');
  isError('* * * a * *', 'day of month: bad format');
  isError('* * * 0 * *', 'day of month: not in range');
  isError('* * * 32 * *', 'day of month: not in range');
  isError('* * * * -1 *', 'month: bad format');
  isError('* * * * a *', 'month: bad format');
  isError('* * * * 0 *', 'month: not in range');
  isError('* * * * 13 *', 'month: not in range');
  isError('* * * * * -1', 'day of week: bad format');
  isError('* * * * * a', 'day of week: bad format');
  isError('* * * * * 8', 'day of week: not in range');

  isError('* * * * ENE *', 'month: bad format');

  isError('1-1 * * * * *', 'second: bad range');
});

function dateMatch(cronExpr, isoStr) {
  const date = new Date(Date.parse(isoStr)),
    cs = parse(cronExpr).result;

  date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
  assert(
    cs.matchesDate(date),
    `${cronExpr} matches ${isoStr}: ${Deno.inspect(cs)} ${date}`
  );
}

function dateDoesntMatch(cronExpr, isoStr) {
  const date = new Date(Date.parse(isoStr)),
    cs = parse(cronExpr).result;

  assert(!cs.matchesDate(date), `${cronExpr} doesn't match ${isoStr}`);
}

Deno.test('CronMatcher.matchesDate', () => {
  dateMatch('* * * * * *', new Date().toISOString());
  dateDoesntMatch('0 * * * * *', '2022-08-18T16:12:56.092Z');
  dateMatch('0 * * * * *', '2022-08-18T16:12:00.092Z');
  dateMatch('0 0 * * * *', '2022-08-18T16:00:00.092Z');
  dateMatch('0 0 0 * * *', '2022-08-18T00:00:00.092Z');
  dateMatch('0 0 0 1 * *', '2022-08-01T00:00:00.092Z');
  dateMatch('0 0 0 1 1 *', '2022-01-01T00:00:00.092Z');
  dateMatch('* * * * * THU', '2022-08-18T16:12:00.092Z');
  dateDoesntMatch('* * * * * FRI', '2022-08-18T16:12:00.092Z');
});

function isoDate(s) {
  return new Date(Date.parse(s));
}

function mkFnMaker() {
  const accum = [];
  function mkFn(name) {
    return date => {
      accum.push({name, date});
    };
  }
  return {mkFn, accum};
}

function sameSchedulerAccum(accum, expected) {
  assertEquals(accum.length, expected.length);
  for (let i = 0; i < accum.length; i++) {
    assertObjectMatch(accum[i], expected[i]);
  }
}

function isResultJob(r) {
  assert(r instanceof Result);
  assert(r.ok);
  assert(!!r.result);
  assertEquals(r.error, null);
}

Deno.test('Scheduler', () => {
  const s1 = new Scheduler(),
    {mkFn, accum} = mkFnMaker(),
    d1 = isoDate('2022-08-18T16:12:00.092Z'),
    d2 = isoDate('2022-08-18T16:12:30.345Z'),
    d3 = isoDate('2022-08-18T16:13:00.092Z'),
    r1 = s1.scheduleFn('0 * * * * *', mkFn('f1')),
    r2 = s1.scheduleFn('30 * * * * *', mkFn('f2'));

  isResultJob(r1);
  isResultJob(r2);

  s1.runMatchingJobs(d1);

  sameSchedulerAccum(accum, [{date: d1, name: 'f1'}]);

  s1.runMatchingJobs(d2);
  sameSchedulerAccum(accum, [
    {date: d1, name: 'f1'},
    {date: d2, name: 'f2'}
  ]);

  s1.unschedule(r1.result.id);
  s1.runMatchingJobs(d3);

  // matching removed task doesn't run
  sameSchedulerAccum(accum, [
    {date: d1, name: 'f1'},
    {date: d2, name: 'f2'}
  ]);
});

Deno.test('Scheduler start/stop', () => {
  class MyScheduler extends Scheduler {
    constructor(currentDates) {
      super();
      this.warns = [];
      this.setTimeouts = [];
      this.clearTimeouts = [];
      this.currentDateIndex = 0;
      this.currentDates = currentDates;
    }
    warn(...args) {
      this.warns.push(args);
    }
    getCurrentDate() {
      return this.currentDates[this.currentDateIndex++];
    }
    setTimeout(fn, ms) {
      this.setTimeouts.push({fn, ms});
      return this.setTimeouts.length;
    }
    clearTimeout(id) {
      this.clearTimeouts.push(id);
    }
  }

  const s = new MyScheduler([isoDate('2022-08-18T16:12:00.092Z')]);

  s.stop();
  assertEquals(s.warns.length, 1);
  assertEquals(s.warns[0][0], 'not running');
  s.warns = [];

  s.start();
  assertEquals(s.warns.length, 0);
  assertEquals(s.setTimeouts.length, 1);
  assertEquals(s.setTimeouts[0].ms, 1000 - 92);
  assertEquals(s.running, true);
  assertEquals(s._setTimeoutId, 1);
  s.start();
  assertEquals(s.warns.length, 1);
  assertEquals(s.warns[0][0], 'already running');
  s.warns = [];
  s.stop();
  assertEquals(s.clearTimeouts.length, 1);
  assertEquals(s.clearTimeouts[0], 1);

  s.stop();
  assertEquals(s.warns.length, 1);
  assertEquals(s.warns[0][0], 'not running');
  s.warns = [];
});
