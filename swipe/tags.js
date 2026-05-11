'use strict';

const TAG_CATEGORIES = [
  {
    key: 'purpose',
    labelKey: 'tagCategoryPurpose',
    tags: [
      { key: 'daily-chat', labelKey: 'tagDailyChat' },
      { key: 'voice-practice', labelKey: 'tagVoicePractice' },
      { key: 'text-chat', labelKey: 'tagTextChat' },
      { key: 'pronunciation', labelKey: 'tagPronunciation' },
      { key: 'grammar', labelKey: 'tagGrammar' },
      { key: 'exam', labelKey: 'tagExam' },
      { key: 'business', labelKey: 'tagBusiness' },
      { key: 'travel', labelKey: 'tagTravel' }
    ]
  },
  {
    key: 'personality',
    labelKey: 'tagCategoryPersonality',
    tags: [
      { key: 'patient', labelKey: 'tagPatient' },
      { key: 'friendly', labelKey: 'tagFriendly' },
      { key: 'outgoing', labelKey: 'tagOutgoing' },
      { key: 'quiet', labelKey: 'tagQuiet' },
      { key: 'humorous', labelKey: 'tagHumorous' },
      { key: 'serious', labelKey: 'tagSerious' }
    ]
  },
  {
    key: 'interests',
    labelKey: 'tagCategoryInterests',
    tags: [
      { key: 'movies', labelKey: 'tagMovies' },
      { key: 'music', labelKey: 'tagMusic' },
      { key: 'games', labelKey: 'tagGames' },
      { key: 'sports', labelKey: 'tagSports' },
      { key: 'food', labelKey: 'tagFood' },
      { key: 'books', labelKey: 'tagBooks' },
      { key: 'anime', labelKey: 'tagAnime' },
      { key: 'technology', labelKey: 'tagTechnology' },
      { key: 'photography', labelKey: 'tagPhotography' },
      { key: 'pets', labelKey: 'tagPets' }
    ]
  },
  {
    key: 'time',
    labelKey: 'tagCategoryTime',
    tags: [
      { key: 'morning', labelKey: 'tagMorning' },
      { key: 'afternoon', labelKey: 'tagAfternoon' },
      { key: 'night', labelKey: 'tagNight' },
      { key: 'weekend', labelKey: 'tagWeekend' },
      { key: 'daily', labelKey: 'tagDaily' }
    ]
  },
  {
    key: 'level',
    labelKey: 'tagCategoryLevel',
    tags: [
      { key: 'beginner', labelKey: 'tagBeginner' },
      { key: 'intermediate', labelKey: 'tagIntermediate' },
      { key: 'advanced', labelKey: 'tagAdvanced' },
      { key: 'native-helper', labelKey: 'tagNativeHelper' }
    ]
  }
];

function getAllTagKeys() {
  const keys = new Set();
  TAG_CATEGORIES.forEach((category) => {
    category.tags.forEach((tag) => keys.add(tag.key));
  });
  return keys;
}

function normaliseSelectedTags(values, max = 12) {
  const allowed = getAllTagKeys();
  const result = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const key = String(value || '').trim().toLowerCase();
    if (!key || !allowed.has(key) || seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(key);
  });
  return result.slice(0, max);
}

module.exports = {
  categories: TAG_CATEGORIES,
  normaliseSelectedTags,
};

