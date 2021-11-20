'use strict';

const path = require('path');
const RightTrackTransitAgency = require('right-track-transit');
const feed = require('./feed.js');

const moduleDirectory = __dirname + "/../";

/**
 * `RightTrackTransitAgency` implementation for the
 * **New York State Thruway Authority (NYSTA)**.
 *
 * For more information, see:
 * - Right Track Transit Agency project ({@link https://github.com/right-track/right-track-transit})
 * - Right Track Transit Agency documentation ({@link https://docs.righttrack.io/right-track-transit})
 *
 * @class
 */
class NYSTA extends RightTrackTransitAgency {

  /**
   * Create a `RightTrackTransitAgency` for NYSTA
   */
  constructor() {
    super(path.normalize(moduleDirectory));
  }

  /**
   * Load the Transit Feed for NYSTA
   * @param {function} callback Callback function
   * @param {Error} [callback.error] Transit Feed Error. The Error's message will be a pipe (|) separated
   * string in the format of: Error Code|Error Type|Error Message that will be parsed out by the Right
   * Track API Server into a more specific error Response.
   * @param {TransitFeed} [callback.feed] The built Transit Feed for NYSTA
   */
  loadFeed(callback) {
    feed(this.config, callback);
  }

}


module.exports = new NYSTA();