NYS Thruway Authority
=====================

**node module:** [right-track-transit-nysta](https://www.npmjs.com/package/right-track-transit-nysta)<br />
**GitHub repo:** [right-track/right-track-transit-nysta](https://github.com/right-track/right-track-transit-nysta)

---

This module is an implementation of a [Right Track Transit Agency](https://github.com/right-track/right-track-agency)
used to create a real-time Transit Feed for the **New York State Thruway Authority**, which is used in the various
[Right Track Projects](https://github.com/right-track).


### Documentation

Documentation about the `RightTrackTransitAgency` class and `TransitFeed` classes can be found in the
[right-track-transit](https://github.com/right-track/right-track-transit) project
and online at [https://docs.righttrack.io/right-track-transit](https://docs.righttrack.io/right-track-transit).

### Usage

This example builds a `TransitFeed` for NYSTA:

```javascript
const nysta = require('right-track-transit-nysta');

nysta.loadFeed(function(err, feed) {
  if ( !err ) {
    console.log(JSON.stringify(feed, null, 2));
  }
});
```