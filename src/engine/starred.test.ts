import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from './save';
import { fixtureGame, run } from './test/fixtures';

describe('stars (35-ui-overhaul.md, section 6)', () => {
  it('star and unstar recipes and resources, any time', () => {
    const s = run(
      fixtureGame(),
      { type: 'star', what: 'recipe', id: 'bp:sack', on: true },
      { type: 'star', what: 'recipe', id: 'basic:tool:1', on: true },
      { type: 'star', what: 'resource', id: 'grass', on: true },
      { type: 'star', what: 'recipe', id: 'bp:sack', on: true },
      { type: 'star', what: 'recipe', id: 'basic:tool:1', on: false },
    );
    expect(s.starred).toEqual({ recipes: ['bp:sack'], resources: ['grass'] });
  });

  it('are saved with the hike and come back on Continue', () => {
    const s = run(fixtureGame(), { type: 'star', what: 'resource', id: 'wood', on: true });
    const back = deserialize(serialize(s));
    expect(back.ok && back.state.starred).toEqual({ recipes: [], resources: ['wood'] });
  });

  it('a save from before stars loads with none', () => {
    const old = JSON.parse(serialize(fixtureGame())) as Record<string, unknown>;
    old.saveVersion = 24;
    delete old.starred;
    const back = deserialize(JSON.stringify(old));
    expect(back.ok).toBe(true);
    expect(back.ok && back.state.starred).toBeUndefined();
  });
});
