const request = require('request');
const { format } = require('url');

const { LEVER_API_KEY } = process.env;

const requestLever = ({ pathname = '/', query = {} }) => {
  return new Promise((resolve, reject) => {
    request(
      {
        auth: { username: LEVER_API_KEY, passport: '' },
        uri: format({
          protocol: 'https',
          hostname: 'api.lever.co',
          pathname,
          query,
          slashes: true,
        }),
        method: 'GET',
        json: true,
      },
      (err, res, body) => {
        if (err) {
          return reject(err);
        }

        if (res.statusCode > 299) {
          return reject(new Error(`Received upstream HTTP ${res.statusCode}`));
        }

        return resolve({ res, body });
      }
    );
  });
};

const updateQuery = (options, update) => ({
  ...options,
  query: { ...options.query, ...update },
});

const unpage = async options => {
  const optionsWithLimit = updateQuery(options, { limit: 100 });
  const { body } = await requestLever(optionsWithLimit);

  if (!body.hasNext) {
    return body.data;
  }

  return [
    ...body.data,
    ...(await unpage(updateQuery(optionsWithLimit, { offset: body.next }))),
  ];
};

const memoize = (f, ttl, resolver = (...args) => args[0]) => {
  const cache = new Map();

  return async (...args) => {
    const key = resolver(...args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = await f(...args);
    cache.set(key, result);
    setTimeout(() => cache.delete(key), ttl);
    return result;
  };
};

const updateObj = (obj, key, updater, notSetValue) => ({
  ...obj,
  [key]: updater(obj[key] === undefined ? notSetValue : obj[key]),
});

const groupBy = (a, grouper) =>
  a.reduce(
    (acc, x) => updateObj(acc, grouper(x), group => group.concat(x), []),
    {}
  );

const get = (obj, key, notSetValue) => (key in obj ? obj[key] : notSetValue);

module.exports = {
  requestLever,
  updateQuery,
  unpage,
  memoize,
  updateObj,
  groupBy,
  get,
};
