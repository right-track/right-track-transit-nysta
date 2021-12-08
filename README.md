NYS Thruway Authority
=====================

**GitHub repo:** [right-track/right-track-transit-nysta](https://github.com/right-track/right-track-transit-nysta)

---

This module is an implementation of a [_RightTrackTransitAgency_](https://github.com/right-track/right-track-core#right-track-transit-agency)
used to create a real-time Transit Feed for the **New York State Thruway Authority**, which is used in the various
[Right Track Projects](https://github.com/right-track).


### Documentation

Documentation about the `RightTrackTransitAgency` class and `TransitFeed` classes can be found in the
[right-track-core](https://github.com/right-track/right-track-core) project
and online at [https://docs.righttrack.io/right-track-core](https://docs.righttrack.io/right-track-core).

### Usage

This example builds a `TransitFeed` for NYSTA:

```javascript
const nysta = require('right-track-transit-nysta');

// Optional: override default agency config
nysta.readConfig('/path/to/agency_local.json');

nysta.loadFeed(function(err, feed) {
  if ( !err ) {
    console.log(JSON.stringify(feed, null, 2));
  }
});
```