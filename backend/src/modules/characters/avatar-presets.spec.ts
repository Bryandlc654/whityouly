import { AVATAR_REFERENCE_PATTERN, isAvatarPresetUrl } from './avatar-presets';

describe('avatares del catálogo', () => {
  it.each(['/avatars/25.svg', '/avatars/36.svg', '/avatars/animal-01.svg', '/avatars/animal-12.svg'])(
    'acepta %s',
    (url) => {
      expect(isAvatarPresetUrl(url)).toBe(true);
      expect(AVATAR_REFERENCE_PATTERN.test(url)).toBe(true);
    },
  );

  it.each(['/avatars/24.svg', '/avatars/animal-00.svg', '/avatars/animal-13.svg', '/avatars/animal-1.svg', '/avatars/../x.svg'])(
    'rechaza %s',
    (url) => {
      expect(isAvatarPresetUrl(url)).toBe(false);
      expect(AVATAR_REFERENCE_PATTERN.test(url)).toBe(false);
    },
  );
});
