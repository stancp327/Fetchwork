/**
 * aiService.js — OpenAI wrapper for Fetchwork AI features.
 * Gracefully degrades if OPENAI_API_KEY is not set.
 */
const { OPENAI_API_KEY } = require('../config/env');

let openaiClient = null;

function getClient() {
  if (!OPENAI_API_KEY) return null;
  if (openaiClient) return openaiClient;
  const { OpenAI } = require('openai');
  openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  return openaiClient;
}

/**
 * Generate a job description using GPT-4o-mini.
 * Falls back to null if no API key — caller should use template fallback.
 */
async function generateJobDescription({ title, category, skills = [], budgetType, budgetAmount, duration, experienceLevel }) {
  const ai = getClient();
  if (!ai) return null;

  const skillList = skills.length ? skills.join(', ') : 'not specified';
  const budget = budgetAmount
    ? `$${budgetAmount} (${budgetType})`
    : budgetType;

  const prompt = [
    `Write a professional job posting description for Fetchwork (a freelance marketplace).`,
    ``,
    `Job details:`,
    `- Title: ${title}`,
    `- Category: ${category}`,
    `- Required skills: ${skillList}`,
    `- Budget: ${budget}`,
    `- Duration: ${duration || 'not specified'}`,
    `- Experience level needed: ${experienceLevel || 'not specified'}`,
    ``,
    `Write 3-4 paragraphs covering: what the job entails, key responsibilities, required skills/experience, and what a successful freelancer looks like. Be specific, professional, and friendly. Avoid generic filler. Return only the description text — no title, no headings.`,
  ].join('\n');

  const response = await ai.chat.completions.create({
    model:       'gpt-4o-mini',
    max_tokens:  500,
    temperature: 0.7,
    messages: [
      { role: 'system', content: 'You are a helpful job posting assistant for Fetchwork, a freelance marketplace. Write clear, engaging job descriptions that attract quality freelancers.' },
      { role: 'user',   content: prompt },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || null;
}

/**
 * Re-rank pre-scored freelancers using GPT and generate a match reason per person.
 * @param {Object} job - Job document fields
 * @param {Array}  candidates - Top algorithmic matches [{userId, name, skills, bio, score}]
 * @returns {Array} [{userId, matchReason, aiScore}] — sorted by aiScore desc
 */
async function aiRankFreelancers(job, candidates) {
  const ai = getClient();
  if (!ai || candidates.length === 0) return null;

  const jobSummary = [
    `Title: ${job.title}`,
    `Category: ${job.category}`,
    `Skills needed: ${(job.skills || []).join(', ') || 'any'}`,
    `Experience: ${job.experienceLevel || 'any'}`,
    `Budget: $${job.budget?.amount} (${job.budget?.type})`,
  ].join('\n');

  const freelancerList = candidates.map((c, i) =>
    `[${i + 1}] ID:${c.userId} | ${c.name} | Skills: ${c.skills.join(', ')} | Rating: ${c.rating.toFixed(1)} | Jobs done: ${c.completedJobs} | Bio: ${c.bio?.slice(0, 120) || 'N/A'}`
  ).join('\n');

  const prompt = [
    `You are a freelance matching engine. Given a job and a list of freelancers, rank them best-to-worst and give a one-sentence match reason for each.`,
    ``,
    `JOB:`,
    jobSummary,
    ``,
    `FREELANCERS:`,
    freelancerList,
    ``,
    `Return a JSON array (no markdown) sorted by match quality, like:`,
    `[{"userId":"...","matchReason":"...","aiScore":95}, ...]`,
    `aiScore is 0-100. Only return the JSON array.`,
  ].join('\n');

  try {
    const response = await ai.chat.completions.create({
      model:       'gpt-4o-mini',
      max_tokens:  800,
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'You are a precise matching engine. Return only valid JSON arrays.' },
        { role: 'user',   content: prompt },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() || '[]';
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

module.exports = { generateJobDescription, aiRankFreelancers, hasAI: () => !!OPENAI_API_KEY };
