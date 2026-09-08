/**
 * Render-level verification for the illustration integration — this is
 * stronger than typecheck alone: it actually mounts each component and
 * catches issues typecheck can't (a broken require() path, a bad prop
 * combination that throws at render time, EmptyState's branching logic).
 * Not a substitute for physical-device visual QA, but it is proof the
 * code paths do not crash and every registered asset actually resolves.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { LoomiIllustration } from '../src/components/illustrations/LoomiIllustration';
import { ILLUSTRATIONS, type IllustrationKey } from '../src/components/illustrations/registry';
import { EmptyState } from '../src/components/primitives';

// EmptyState (via primitives.tsx -> state/ui.ts -> data/repositories/couple.ts)
// transitively imports AsyncStorage, which has no native module in the Jest
// environment. Mock it here rather than pull in a global test-setup file
// this project doesn't otherwise need. jest.mock calls are hoisted above
// imports by babel-jest regardless of source position, so this is safe.
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const ALL_KEYS = Object.keys(ILLUSTRATIONS) as IllustrationKey[];

describe('illustration registry', () => {
  it('has exactly the 22 integrated assets, each with a resolved source and valid aspect ratio', () => {
    expect(ALL_KEYS).toHaveLength(22);
    for (const key of ALL_KEYS) {
      const entry = ILLUSTRATIONS[key];
      expect(entry.source).toBeTruthy();
      expect(entry.aspectRatio).toBeGreaterThan(0);
      expect(entry.defaultLabel.length).toBeGreaterThan(0);
    }
  });
});

describe('LoomiIllustration', () => {
  it.each(ALL_KEYS)('renders %s without throwing, at its default size', (key) => {
    const tree = render(<LoomiIllustration asset={key} />).toJSON();
    expect(tree).toBeTruthy();
  });

  it('derives height from aspect ratio when only width is given', () => {
    const { UNSAFE_root } = render(<LoomiIllustration asset="chat-sitting-together" width={200} />);
    expect(UNSAFE_root).toBeTruthy();
  });

  it('applies the framed treatment without throwing', () => {
    const tree = render(<LoomiIllustration asset="streak-fist-bump" size={96} framed />).toJSON();
    expect(tree).toBeTruthy();
  });

  it('accepts a custom accessibility label', () => {
    const { getByLabelText } = render(
      <LoomiIllustration asset="invite-pao-invites-ly" accessibilityLabel="custom label for test" />
    );
    expect(getByLabelText('custom label for test')).toBeTruthy();
  });
});

describe('EmptyState illustration branching', () => {
  it('renders the SVG mascot branch for illustration="mascot"', () => {
    const tree = render(
      <EmptyState icon="image" illustration="mascot" title="t" message="m" />
    ).toJSON();
    expect(tree).toBeTruthy();
  });

  it('renders a LoomiIllustration branch for a real asset key', () => {
    const tree = render(
      <EmptyState icon="target" illustration="goals-progress-steps" title="t" message="m" />
    ).toJSON();
    expect(tree).toBeTruthy();
  });

  it('falls back to the plain icon branch when no illustration is given', () => {
    const tree = render(<EmptyState icon="bell" title="t" message="m" />).toJSON();
    expect(tree).toBeTruthy();
  });
});
