//@format

// TODO: check that interval by is within matcher's range
// TODO: handle timezones, an expression may want to run on a timezone different than the
// server's timezone

class Matcher {
  matches(_) {
    return false;
  }

  isIntervalMatcher() {
    return false;
  }

  matchesInterval(_v, _by) {
    return false;
  }

  matchesIntervalRange(_) {
    return false;
  }

  isInRange(_from, _to) {
    return false;
  }

  check(from, to) {
    if (!this.isInRange(from, to)) {
      return 'not in range';
    }
    return null;
  }

  isEqual(_) {
    return false;
  }
}

class Wildcard extends Matcher {
  matches(_) {
    return true;
  }

  isIntervalMatcher() {
    return true;
  }

  matchesInterval(v, by) {
    return v % by === 0;
  }

  matchesIntervalRange(_v) {
    return true;
  }

  isInRange(_from, _to) {
    return true;
  }

  isEqual(o) {
    return o instanceof Wildcard;
  }
}

class Constant extends Matcher {
  constructor(v) {
    super();
    if (!Number.isFinite(v)) {
      throw new Error('Bad constant value: ' + v);
    }
    this.v = v;
  }

  matches(v) {
    return this.v === v;
  }

  isIntervalMatcher() {
    return true;
  }

  matchesInterval(v, by) {
    const offset = v - this.v;
    return offset >= 0 && offset % by === 0;
  }

  matchesIntervalRange(v) {
    return v >= this.v;
  }

  isInRange(from, to) {
    return this.v >= from && this.v <= to;
  }

  isEqual(o) {
    return o instanceof Constant && this.v === o.v;
  }
}

class Range extends Matcher {
  constructor(from, to) {
    super();
    this.from = from;
    this.to = to;
  }

  matches(v) {
    return v >= this.from && v <= this.to;
  }

  isIntervalMatcher() {
    return true;
  }

  matchesInterval(v, by) {
    const offset = v - this.from;
    return offset >= 0 && offset % by === 0;
  }

  matchesIntervalRange(v) {
    return this.matches(v);
  }

  isInRange(from, to) {
    return this.from >= from && this.to <= to;
  }

  check(from, to) {
    if (!this.isInRange(from, to)) {
      return 'not in range';
    } else if (this.from >= this.to) {
      return 'bad range';
    }
    return null;
  }

  isEqual(o) {
    return o instanceof Range && this.from === o.from && this.to === o.to;
  }
}

class Interval extends Matcher {
  constructor(matcher, by) {
    super();
    if (!matcher.isIntervalMatcher()) {
      throw new Error('Invalid interval matcher');
    }
    this.matcher = matcher;
    this.by = by;
  }

  matches(v) {
    return (
      this.matcher.matchesIntervalRange(v) &&
      this.matcher.matchesInterval(v, this.by)
    );
  }

  isInRange(from, to) {
    return this.matcher.isInRange(from, to);
  }

  isEqual(o) {
    return (
      o instanceof Interval &&
      this.matcher.isEqual(o.matcher) &&
      this.by === o.by
    );
  }
}

class Sequence extends Matcher {
  constructor(matchers) {
    super();
    this.matchers = matchers;
  }

  matches(v) {
    for (let matcher of this.matchers) {
      if (matcher.matches(v)) {
        return true;
      }
    }
  }

  isInRange(from, to) {
    return this.matchers.every((matcher, _i, _) => matcher.isInRange(from, to));
  }

  isEqual(o) {
    return (
      o instanceof Sequence &&
      this.matchers.length === o.matchers.length &&
      this.matchers.every((m, i, _) => m.isEqual(o.matchers[i]))
    );
  }
}

class Result {
  constructor(ok, result, error) {
    this.ok = ok;
    this.result = result;
    this.error = error;
  }
}

Result.ok = function (result) {
  return new Result(true, result, null);
};

Result.error = function (error) {
  return new Result(false, null, error);
};

function checkPart(matcher, name, from, to) {
  if (matcher === null) {
    return Result.error(name + ': bad format');
  }

  const error = matcher.check(from, to);
  if (error !== null) {
    return Result.error(name + ': ' + error);
  }

  return null;
}

function parse(s) {
  const parts = s.trim().split(' ');
  if (parts.length !== 6) {
    return Result.error('6 values required');
  }

  const [secsS, minsS, hoursS, dayOfMonthS, monthS, dayOfWeekS] = parts;

  const secsM = parsePart(secsS, parseNumber);
  let err = checkPart(secsM, 'second', 0, 59);
  if (err) {
    return err;
  }

  const minsM = parsePart(minsS, parseNumber);
  err = checkPart(minsM, 'minute', 0, 59);
  if (err) {
    return err;
  }

  const hoursM = parsePart(hoursS, parseNumber);
  err = checkPart(hoursM, 'hour', 0, 23);
  if (err) {
    return err;
  }

  const dayOfMonthM = parsePart(dayOfMonthS, parseNumber);
  err = checkPart(dayOfMonthM, 'day of month', 1, 31);
  if (err) {
    return err;
  }

  const monthM = parsePart(monthS, parseMonth);
  err = checkPart(monthM, 'month', 1, 12);
  if (err) {
    return err;
  }

  const dayOfWeekM = parsePart(dayOfWeekS, parseDayOfWeek);
  err = checkPart(dayOfWeekM, 'day of week', 0, 6);
  if (err) {
    return err;
  }

  const result = new CronMatcher(
    secsM,
    minsM,
    hoursM,
    dayOfMonthM,
    monthM,
    dayOfWeekM
  );
  return Result.ok(result);
}

class CronMatcher {
  constructor(seconds, minutes, hours, daysOfMonth, months, daysOfWeek) {
    this.seconds = seconds;
    this.minutes = minutes;
    this.hours = hours;
    this.daysOfMonth = daysOfMonth;
    this.months = months;
    this.daysOfWeek = daysOfWeek;
  }

  matchesDate(d) {
    return (
      this.seconds.matches(d.getSeconds()) &&
      this.minutes.matches(d.getMinutes()) &&
      this.hours.matches(d.getHours()) &&
      this.daysOfMonth.matches(d.getDate()) &&
      this.months.matches(d.getMonth() + 1) &&
      this.daysOfWeek.matches(d.getDay())
    );
  }

  isEqual(o) {
    return (
      o instanceof CronMatcher &&
      this.seconds.isEqual(o.seconds) &&
      this.minutes.isEqual(o.minutes) &&
      this.hours.isEqual(o.hours) &&
      this.daysOfMonth.isEqual(o.daysOfMonth) &&
      this.months.isEqual(o.months) &&
      this.daysOfWeek.isEqual(o.daysOfWeek)
    );
  }
}

function parsePart(s, valueParserFn) {
  const matchers = s
    .split(',')
    .map((matcherStr, _i, _) => parseMatcher(matcherStr, valueParserFn));
  if (matchers.length === 1) {
    return matchers[0];
  } else {
    return new Sequence(matchers);
  }
}

function parseMatcher(s, valueParserFn) {
  const parts = s.split('/');
  if (parts.length === 1) {
    return parseRangeOrScalar(parts[0], valueParserFn);
  } else if (parts.length === 2) {
    const [rangeV, byV] = parts,
      rangeOrScalar = parseRangeOrScalar(rangeV, valueParserFn);

    if (rangeOrScalar === null) {
      return null;
    }

    const by = parseNumber(byV);

    if (by === null) {
      return null;
    }

    return new Interval(rangeOrScalar, by);
  } else {
    return null;
  }
}

function parseRangeOrScalar(s, valueParserFn) {
  const partsR = s.split('-');
  if (partsR.length === 1) {
    const [v] = partsR;
    if (v === '*') {
      return new Wildcard();
    } else {
      const parsed = valueParserFn(v);
      return parsed === null ? null : new Constant(parsed);
    }
  } else if (partsR.length === 2) {
    const [fromV, toV] = partsR,
      from = valueParserFn(fromV),
      to = valueParserFn(toV);

    if (from === null || to === null) {
      return null;
    } else {
      return new Range(from, to);
    }
  } else {
    return null;
  }
}

function parseNumber(v) {
  const r = parseInt(v, 10);
  return Number.isFinite(r) ? r : null;
}

const MONTH_TO_NUM = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12
};

function parseMonth(v) {
  return MONTH_TO_NUM[v] ?? parseNumber(v);
}

const DAY_OF_WEEK_TO_NUM = {
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
  SUN: 0
};

function parseDayOfWeek(v) {
  const r = DAY_OF_WEEK_TO_NUM[v] ?? parseNumber(v);
  return r === 7 ? 0 : r;
}

class TaskFn {
  constructor(fn) {
    this.fn = fn;
  }

  run(date) {
    return this.fn(date);
  }
}

class ScheduleJob {
  constructor(id, task, schedule) {
    this.id = id;
    this.task = task;
    this.schedule = schedule;
  }

  matchesDate(date) {
    return this.schedule.matchesDate(date);
  }

  run(date) {
    return this.task.run(date);
  }
}

class Scheduler {
  constructor() {
    this._idGen = 0;
    this.jobs = {};
    this.running = false;
    this._setTimeoutId = null;
  }

  nextId() {
    return `job${this._idGen++}`;
  }

  schedule(cronExpr, task) {
    const jobId = this.nextId(),
      result = parse(cronExpr);

    if (result.ok) {
      const job = new ScheduleJob(jobId, task, result.result);
      this.jobs[jobId] = job;
      return Result.ok(job);
    } else {
      return result;
    }
  }

  scheduleFn(cronExpr, fn) {
    return this.schedule(cronExpr, new TaskFn(fn));
  }

  unschedule(jobId) {
    const job = this.jobs[jobId];
    delete this.jobs[jobId];
    return job;
  }

  getNextTickTsFor(dateIn) {
    const date = new Date(dateIn.getTime());
    date.setMilliseconds(0);
    date.setSeconds(date.getSeconds() + 1);
    return date.getTime();
  }

  scheduleNextTick(date) {
    const nextTs = this.getNextTickTsFor(date),
      diff = nextTs - date.getTime();
    this._setTimeoutId = this.setTimeout(() => this.onTick(), diff);
  }

  onTick() {
    const date = this.getCurrentDate();
    this.scheduleNextTick(date);
    this.runMatchingJobs(date);
  }

  start() {
    if (this.running) {
      this.warn('already running');
    } else {
      this.running = true;
      this.scheduleNextTick(this.getCurrentDate());
    }
  }

  stop() {
    if (this.running) {
      this.running = false;
      this.clearTimeout(this._setTimeoutId);
      this._setTimeoutId = null;
    } else {
      this.warn('not running');
    }
  }

  runMatchingJobs(date) {
    for (let jobId in this.jobs) {
      const job = this.jobs[jobId];
      if (job.matchesDate(date)) {
        job.run(date);
      }
    }
  }

  warn(...args) {
    console.warn(...args);
  }
  getCurrentDate() {
    return new Date();
  }
  setTimeout(fn, ms) {
    return setTimeout(fn, ms);
  }
  clearTimeout(id) {
    return clearTimeout(id);
  }
}

export {
  parse,
  Scheduler,
  ScheduleJob,
  TaskFn,
  Result,
  Constant,
  Interval,
  Range,
  Sequence,
  Wildcard,
  CronMatcher,
  DAY_OF_WEEK_TO_NUM,
  MONTH_TO_NUM
};
