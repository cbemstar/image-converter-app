/**
 * Fetches all preset JSON files.
 * @returns {Promise<Array<object>>} list of presets
 */
export async function getPresets() {
  const index = [
    'google-rda-landscape.json',
    'google-rda-square.json',
    'facebook-feed-1-1.json',
    'facebook-feed-4-5.json',
    'instagram-story.json',
    'linkedin-single-1-91.json',
    'linkedin-single-1-1.json',
    'twitter-image-1-91.json',
    'pinterest-standard.json',
    'poster-a1.json',
    'poster-a2.json',
    'poster-a3.json',
    'poster-a4.json',
    'dle-flyer.json',
    'pullup-850x2000.json',
    'billboard-3600x2400.json'
  ];
  const presets = [];
  for (const file of index) {
    const res = await fetch(`presets/${file}`);
    if (res.ok) {
      presets.push(await res.json());
    }
  }
  return presets;
}
