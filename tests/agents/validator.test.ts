import { describe, it, expect } from 'vitest';
import { validateAgentYaml } from '../../src/agents/validator.js';

describe('validateAgentYaml', () => {
  const validRaw = {
    name: 'my-agent',
    description: 'A test agent',
    model: 'claude-sonnet-4-6',
    tools: [],
  };

  it('returns validated object for a fully valid config', () => {
    const result = validateAgentYaml(validRaw, 'my-agent');
    expect(result.name).toBe('my-agent');
    expect(result.description).toBe('A test agent');
    expect(result.model).toBe('claude-sonnet-4-6');
    expect(result.tools).toEqual([]);
  });

  it('defaults tools to [] when field is absent', () => {
    const raw = { name: 'my-agent', description: 'desc', model: 'claude-sonnet-4-6' };
    const result = validateAgentYaml(raw, 'my-agent');
    expect(result.tools).toEqual([]);
  });

  it('throws when input is not an object', () => {
    expect(() => validateAgentYaml('a string', 'my-agent')).toThrow('my-agent');
    expect(() => validateAgentYaml(null, 'my-agent')).toThrow('my-agent');
    expect(() => validateAgentYaml(['array'], 'my-agent')).toThrow('my-agent');
  });

  it('throws with field name when "name" is missing', () => {
    const raw = { description: 'desc', model: 'claude-sonnet-4-6' };
    expect(() => validateAgentYaml(raw, 'my-agent')).toThrow('"name"');
  });

  it('throws when "name" does not match directory name', () => {
    const raw = { ...validRaw, name: 'wrong-name' };
    expect(() => validateAgentYaml(raw, 'my-agent')).toThrow('wrong-name');
  });

  it('throws with field name when "description" is missing', () => {
    const raw = { name: 'my-agent', model: 'claude-sonnet-4-6' };
    expect(() => validateAgentYaml(raw, 'my-agent')).toThrow('"description"');
  });

  it('throws with field name when "model" is missing', () => {
    const raw = { name: 'my-agent', description: 'desc' };
    expect(() => validateAgentYaml(raw, 'my-agent')).toThrow('"model"');
  });

  it('throws when "tools" is not an array', () => {
    const raw = { ...validRaw, tools: 'not-an-array' };
    expect(() => validateAgentYaml(raw, 'my-agent')).toThrow('"tools"');
  });

  it('throws when "tools" contains non-string elements', () => {
    const raw = { ...validRaw, tools: [1, 2, 3] };
    expect(() => validateAgentYaml(raw, 'my-agent')).toThrow('"tools"');
  });

  it('includes agent dir name in all error messages', () => {
    expect(() => validateAgentYaml({}, 'target-agent')).toThrow('target-agent');
  });
});
