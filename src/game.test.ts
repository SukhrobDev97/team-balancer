import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addPlayers,
  changePlayerTier,
  emptySession,
  isComplete,
  markRosterDirty,
  remaining,
  removePlayer,
} from './game.js';
import { parsePlayerNames } from './utils.js';
import {
  balanceLabel,
  canAddNames,
  isValidPlayerCount,
  isValidTeamCount,
  validTeamCounts,
} from './utils.js';
import { MAX_PLAYERS, MAX_TEAMS, MIN_PER_TEAM, MIN_PLAYERS, MIN_TEAMS } from './types.js';
import { balanceTeams } from './team-balancer.js';

describe('player count validation', () => {
  it('accepts 4–50', () => {
    assert.equal(isValidPlayerCount(4, MIN_PLAYERS, MAX_PLAYERS), true);
    assert.equal(isValidPlayerCount(50, MIN_PLAYERS, MAX_PLAYERS), true);
    assert.equal(isValidPlayerCount(3, MIN_PLAYERS, MAX_PLAYERS), false);
    assert.equal(isValidPlayerCount(51, MIN_PLAYERS, MAX_PLAYERS), false);
  });

  it('custom counts use the same rule', () => {
    assert.equal(isValidPlayerCount(17, MIN_PLAYERS, MAX_PLAYERS), true);
    assert.equal(isValidPlayerCount(1, MIN_PLAYERS, MAX_PLAYERS), false);
  });
});

describe('team count options', () => {
  it('requires at least 2 players per team', () => {
    assert.deepEqual(
      validTeamCounts(20, MIN_TEAMS, MAX_TEAMS, MIN_PER_TEAM),
      [2, 3, 4, 5],
    );
    assert.deepEqual(
      validTeamCounts(8, MIN_TEAMS, MAX_TEAMS, MIN_PER_TEAM),
      [2, 3, 4],
    );
    assert.deepEqual(
      validTeamCounts(5, MIN_TEAMS, MAX_TEAMS, MIN_PER_TEAM),
      [2],
    );
    assert.equal(
      isValidTeamCount(5, 8, MIN_TEAMS, MAX_TEAMS, MIN_PER_TEAM),
      false,
    );
  });
});

describe('roster edits', () => {
  it('adds A–E bulk names without exceeding cap', () => {
    const s = emptySession(1);
    s.playerCount = 5;
    const a = addPlayers(s, ['Sardor', 'Muhammad Ali'], 'A');
    assert.equal(a.ok, true);
    const overflow = addPlayers(s, ['Bek', 'Ali', 'Jasur', 'Extra'], 'E');
    assert.equal(overflow.ok, false);
    if (!overflow.ok) assert.equal(overflow.remaining, 3);
    const e2 = addPlayers(s, ['Bek', 'Ali', 'Jasur'], 'E');
    assert.equal(e2.ok, true);
    assert.equal(s.players.length, 5);
    assert.equal(s.players.filter((p) => p.tier === 'E').length, 3);
    assert.equal(s.players[1]?.name, 'Muhammad Ali');
    assert.equal(new Set(s.players.map((p) => p.id)).size, 5);
  });

  it('rejects overflow without partial add', () => {
    const s = emptySession(1);
    s.playerCount = 3;
    addPlayers(s, ['A', 'B'], 'C');
    const before = s.players.map((p) => p.id);
    const r = addPlayers(s, ['X', 'Y'], 'D');
    assert.equal(r.ok, false);
    assert.deepEqual(
      s.players.map((p) => p.id),
      before,
    );
    assert.equal(canAddNames(2, 3, 2), false);
    assert.equal(canAddNames(2, 3, 1), true);
  });

  it('removes a player and changes tier without duplicates', () => {
    const s = emptySession(1);
    s.playerCount = 3;
    addPlayers(s, ['Sardor', 'Aziz', 'Bek'], 'A');
    const id = s.players[1]!.id;
    const changed = changePlayerTier(s, id, 'B');
    assert.equal(changed?.from, 'A');
    assert.equal(changed?.to, 'B');
    assert.equal(s.players.filter((p) => p.id === id).length, 1);
    const removed = removePlayer(s, id);
    assert.equal(removed?.name, 'Aziz');
    assert.equal(s.players.length, 2);
    assert.equal(s.players.some((p) => p.id === id), false);
    assert.equal(remaining(s), 1);
    assert.equal(isComplete(s), false);
  });

  it('editing after finish invalidates result step', () => {
    const s = emptySession(1);
    s.playerCount = 4;
    s.teamCount = 2;
    addPlayers(s, ['A1', 'A2', 'A3', 'A4'], 'C');
    s.step = 'FINISHED';
    markRosterDirty(s);
    assert.equal(s.step, 'TIER_MENU');
    const teams = balanceTeams(s.players, 2);
    const ids = teams.flatMap((t) => t.players.map((p) => p.id)).sort();
    assert.deepEqual(ids, s.players.map((p) => p.id).sort());
  });

  it('reshuffle-style second balance keeps the same roster', () => {
    const s = emptySession(1);
    s.playerCount = 10;
    addPlayers(s, parsePlayerNames('Sardor, Aziz\nBekzod'), 'A');
    addPlayers(s, ['Temur', 'Sanjar'], 'B');
    addPlayers(s, ['Ali', 'Vali', 'Gani', 'Doni', 'Eni'], 'E');
    const roster = s.players.map((p) => `${p.id}:${p.tier}:${p.name}`).sort();
    const first = balanceTeams(s.players, 2);
    const second = balanceTeams(s.players, 2);
    const sizes1 = first.map((t) => t.players.length);
    const sizes2 = second.map((t) => t.players.length);
    assert.ok(Math.max(...sizes1) - Math.min(...sizes1) <= 1);
    assert.ok(Math.max(...sizes2) - Math.min(...sizes2) <= 1);
    assert.deepEqual(
      first.flatMap((t) => t.players.map((p) => `${p.id}:${p.tier}:${p.name}`)).sort(),
      roster,
    );
    assert.deepEqual(
      second.flatMap((t) => t.players.map((p) => `${p.id}:${p.tier}:${p.name}`)).sort(),
      roster,
    );
  });
});

describe('balance label', () => {
  it('maps score gap to copy', () => {
    assert.equal(balanceLabel(0), "⚖️ Balans: A'lo");
    assert.equal(balanceLabel(1), "⚖️ Balans: A'lo");
    assert.equal(balanceLabel(2), '⚖️ Balans: Yaxshi');
    assert.equal(balanceLabel(3), '⚖️ Balans: Imkon qadar tenglashtirildi');
  });
});
