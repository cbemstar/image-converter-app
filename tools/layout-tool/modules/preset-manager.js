/**
 * Fetches all preset JSON files and adds category information.
 * @returns {Promise<Array<object>>} list of presets with categories
 */
export async function getPresets() {
  // Only include presets that actually exist
  const presetIndex = {
    // Social Media Presets
    social: [
      'facebook-feed-1-1.json',
      'facebook-feed-4-5.json',
      'facebook-cover.json',
      'instagram-feed-1-1.json',
      'instagram-feed-4-5.json',
      'instagram-story.json',
      'instagram-reel.json',
      'linkedin-single-1-1.json',
      'linkedin-single-1-91.json',
      'linkedin-cover.json',
      'twitter-image-1-91.json',
      'twitter-header.json',
      'pinterest-standard.json',
      'youtube-thumbnail.json',
      'youtube-shorts.json',
      'tiktok-video.json'
    ],
    
    // Digital Advertising Presets
    digital: [
      'google-rda-landscape.json',
      'google-rda-square.json',
      'google-display-banner.json',
      'google-display-rectangle.json',
      'google-display-large-rectangle.json',
      'google-display-skyscraper.json',
      'web-banner-leaderboard.json',
      'email-header.json',
      'website-hero-banner.json'
    ],
    
    // Print Materials Presets
    print: [
      'business-card-standard.json',
      'business-card-us.json',
      'postcard-standard.json',
      'brochure-trifold.json',
      'poster-a0.json',
      'poster-a1.json',
      'poster-a2.json',
      'poster-a3.json',
      'poster-a4.json',
      'poster-a5.json',
      'magazine-cover.json',
      'book-cover-paperback.json',
      'dle-flyer.json',
      'pullup-850x2000.json',
      'banner-vinyl.json',
      'billboard-3600x2400.json'
    ]
  };
  
  const categoryMap = {
    'social': 'Social Media',
    'print': 'Print Materials',
    'digital': 'Digital Advertising'
  };
  
  const subcategoryMap = {
    // Social Media Subcategories
    'facebook-feed-1-1.json': 'Facebook',
    'facebook-feed-4-5.json': 'Facebook',
    'facebook-cover.json': 'Facebook',
    'instagram-feed-1-1.json': 'Instagram',
    'instagram-feed-4-5.json': 'Instagram',
    'instagram-story.json': 'Instagram',
    'instagram-reel.json': 'Instagram',
    'linkedin-single-1-1.json': 'LinkedIn',
    'linkedin-single-1-91.json': 'LinkedIn',
    'linkedin-cover.json': 'LinkedIn',
    'twitter-image-1-91.json': 'Twitter',
    'twitter-header.json': 'Twitter',
    'pinterest-standard.json': 'Pinterest',
    'youtube-thumbnail.json': 'YouTube',
    'youtube-shorts.json': 'YouTube',
    'tiktok-video.json': 'TikTok',
    
    // Digital Advertising Subcategories
    'google-rda-landscape.json': 'Google Ads',
    'google-rda-square.json': 'Google Ads',
    'google-display-banner.json': 'Display Ads',
    'google-display-rectangle.json': 'Display Ads',
    'google-display-large-rectangle.json': 'Display Ads',
    'google-display-skyscraper.json': 'Display Ads',
    'web-banner-leaderboard.json': 'Web Banners',
    'email-header.json': 'Email Marketing',
    'website-hero-banner.json': 'Website',
    
    // Print Materials Subcategories
    'business-card-standard.json': 'Business Cards',
    'business-card-us.json': 'Business Cards',
    'postcard-standard.json': 'Marketing Materials',
    'brochure-trifold.json': 'Marketing Materials',
    'poster-a0.json': 'Posters',
    'poster-a1.json': 'Posters',
    'poster-a2.json': 'Posters',
    'poster-a3.json': 'Posters',
    'poster-a4.json': 'Posters',
    'poster-a5.json': 'Posters',
    'magazine-cover.json': 'Publications',
    'book-cover-paperback.json': 'Publications',
    'dle-flyer.json': 'Marketing Materials',
    'pullup-850x2000.json': 'Large Format',
    'banner-vinyl.json': 'Large Format',
    'billboard-3600x2400.json': 'Large Format'
  };
  
  const presets = [];
  
  // Load all presets from all categories
  for (const [channel, files] of Object.entries(presetIndex)) {
    for (const file of files) {
      try {
        const res = await fetch(`presets/${file}`);
        if (res.ok) {
          const preset = await res.json();
          
          // Add category and subcategory information
          preset.category = categoryMap[preset.channel] || 'Other';
          preset.subcategory = subcategoryMap[file] || 'General';
          
          // Ensure width and height are set (convert from mm if needed)
          if (preset.width_mm && preset.height_mm) {
            // Convert mm to pixels at 300 DPI for high quality
            preset.width = Math.round(preset.width_mm * 11.811); // 300 DPI conversion
            preset.height = Math.round(preset.height_mm * 11.811);
          }
          
          // Add file reference for debugging
          preset.file = file;
          
          presets.push(preset);
        }
      } catch (error) {
        console.warn(`Failed to load preset ${file}:`, error);
      }
    }
  }
  
  // Sort presets by category, then subcategory, then name
  presets.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    if (a.subcategory !== b.subcategory) {
      return a.subcategory.localeCompare(b.subcategory);
    }
    return a.name.localeCompare(b.name);
  });
  
  return presets;
}

/**
 * Get presets filtered by channel
 * @param {string} channel - The channel to filter by ('social', 'digital', 'print', 'all')
 * @returns {Promise<Array<object>>} Filtered presets
 */
export async function getPresetsByChannel(channel) {
  const allPresets = await getPresets();
  
  if (channel === 'all') {
    return allPresets;
  }
  
  return allPresets.filter(preset => preset.channel === channel);
}

/**
 * Get preset categories with counts
 * @returns {Promise<Array<object>>} Categories with preset counts
 */
export async function getPresetCategories() {
  const presets = await getPresets();
  const categories = {};
  
  presets.forEach(preset => {
    if (!categories[preset.category]) {
      categories[preset.category] = {
        name: preset.category,
        channel: preset.channel,
        count: 0,
        subcategories: {}
      };
    }
    
    categories[preset.category].count++;
    
    if (!categories[preset.category].subcategories[preset.subcategory]) {
      categories[preset.category].subcategories[preset.subcategory] = 0;
    }
    categories[preset.category].subcategories[preset.subcategory]++;
  });
  
  return Object.values(categories);
}
