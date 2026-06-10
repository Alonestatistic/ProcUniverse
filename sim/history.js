// History: importance-scored events, first-ever tracking, minor-event aggregation.
"use strict";

class History {
  constructor() {
    this.events = [];
    this._minorImpacts = { count: 0, water: 0, since: 0 };
    this.seq = 0;
  }
  record(world, ev) {
    ev.id = ++this.seq;
    ev.time = world.ageYears;
    ev.tick = world.tickCount;
    ev.importance = Math.round(Math.min(10, ev.importance) * 10) / 10;
    this.events.push(ev);
    // bound memory: drop the least important old events when very long
    if (this.events.length > 600) {
      const sorted = [...this.events].sort((a, b) => a.importance - b.importance);
      const dropSet = new Set(sorted.slice(0, 100).map(e => e.id));
      this.events = this.events.filter(e => !dropSet.has(e.id));
    }
    return ev;
  }
  // aggregate the steady drizzle of small impacts into one summary per ~200 Myr
  accumulateMinorImpacts(world, s) {
    const m = this._minorImpacts;
    if (m.since === 0) m.since = world.ageYears;
    m.count += s.count; m.water += s.water;
    if (world.ageYears - m.since > 2e8 && m.count > 0) {
      if (m.water > 2 || m.count > 50) {
        this.record(world, {
          type: "impact", importance: 3,
          text: "Between " + window.SimNames.fmtAge(m.since) + " and " + window.SimNames.fmtAge(world.ageYears)
            + ", ~" + m.count + " minor impacts delivered volatiles"
            + (m.water > 2 ? " and substantial water to the surface" : "") + ".",
        });
      }
      m.count = 0; m.water = 0; m.since = world.ageYears;
    }
  }
}

window.SimHistory = { History };
