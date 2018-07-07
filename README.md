# Interview Badge

Responds to Passport webhook requests with whether or not each user has
completed a certain amount of interviews.

Expects a `count` querystring parameter to be set which defines the threshold
that must be passed to earn an interview badge of that count.  This allows
arbitrary badges to be registered with Passport.

## TODO

* Needs a Lever API Key--this effectively grants admin read/write to lever.
* Add auth secret / HMAC to outgoing Passport webhooks
* Deploy with next/up?
