const { parse } = require('url');
const { json, send } = require('micro');

const { unpage, memoize, updateObj, groupBy, get } = require('./lib');

const fetchCandidates = () => unpage({ pathname: '/candidates' });
const fetchPanels = cid => unpage({ pathname: `/candidates/${cid}/panels` });

const fetchInterviews = async () => {
  let interviews = [];

  const candidates = await fetchCandidates();
  for (const candidate of candidates) {
    for (const panel of await fetchPanels(candidate.id)) {
      interviews = [...interviews, ...panel.interviews];
    }
  }

  return interviews;
};

const ONE_DAY = 1000 * 60 * 60 * 24;
const fetchInterviewsCache = memoize(fetchInterviews, ONE_DAY);

const coalesceInterviewsByEmail = interviews => {
  let result = {};

  const interviewsThatOccurred = interviews
    .filter(i => i.canceledAt === null)
    .sort((a, b) => a.date - b.date);

  for (const interview of interviewsThatOccurred) {
    for (const interviewer of interview.interviewers) {
      result = updateObj(
        result,
        interviewer.email,
        x => x.concat(interview.date),
        []
      );
    }
  }

  return result;
};

const shouldGrant = (interviewsByEmail, count) => person =>
  get(interviewsByEmail, person.email, []).length >= count;

const format = (interviewsByEmail, count) => person =>
  shouldGrant(interviewsByEmail, count)(person)
    ? {
        username: person.username,
        date_granted: new Date(
          interviewsByEmail[person.email][count - 1]
        ).toISOString(),
      }
    : { username: person.username };

const isAuthenticated = req => true;

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) {
    send(res, 401, 'Requests require authorization');
  }

  const count = parseInt(parse(req.url, true).query.count);
  if (isNaN(count) || count <= 0) {
    return send(
      res,
      400,
      'Expected `count` to be set in the querystring with a positive integer'
    );
  }

  let body;
  try {
    body = await json(req);
  } catch (e) {
    return send(res, 400, 'Expected a JSON payload in the request body');
  }

  const { people } = body;

  if (!Array.isArray(people)) {
    return send(res, 400, 'Expected `people` in request body to be an array');
  }

  const interviewsByEmail = coalesceInterviewsByEmail(
    await fetchInterviewsCache()
  );

  const { true: grantTo, false: revokeFrom } = groupBy(
    people,
    shouldGrant(interviewsByEmail, count)
  );

  return {
    grant_to: (grantTo || []).map(format(interviewsByEmail, count)),
    revoke_from: (revokeFrom || []).map(format(interviewsByEmail, count)),
  };
};
