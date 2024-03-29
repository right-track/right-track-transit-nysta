'use strict';

const https = require('https');
const parseXML = require('xml2js').parseString;

const TF = require('right-track-core/modules/classes/RightTrackTransitAgency/TransitFeed');
const TransitFeed = TF.TransitFeed;
const TransitDivision = TF.TransitDivision;
const TransitEvent = TF.TransitEvent;

// Agency Config
let CONFIG = {};


// Feed Cache
let CACHE = undefined;
let CACHE_UPDATED = new Date(0);


/**
 * Load the NYSTA Transit Feed
 * @param {Object} config Transit Agency config
 * @param {function} callback Callback function
 * @param {Error} [callback.error] Transit Feed Error. The Error's message will be a pipe (|) separated
 * string in the format of: Error Code|Error Type|Error Message that will be parsed out by the Right
 * Track API Server into a more specific error Response.
 * @param {TransitFeed} [callback.feed] The built Transit Feed for NYSTA
 */
function loadFeed(config, callback) {

  // Set Config
  CONFIG = config;

  // Return Cached Feed
  if ( CACHE !== undefined &&
    CACHE_UPDATED.getTime() >= (new Date().getTime() - (CONFIG.maxCache*1000)) ) {
    return callback(null, CACHE);
  }

  // Get Fresh Feed
  else {

    // Download the Feed
    _download(function(xml) {

      // Process the Feed
      if ( xml ) {
        _parse(xml, function(feed) {

          // Return the Feed
          if ( feed ) {
            CACHE = feed;
            CACHE_UPDATED = feed.updated;
            return callback(null, feed);
          }

          // No Feed Returned
          else {
            _parseError();
          }

        });
      }

      // No Feed Returned
      else {
        _parseError();
      }

    });

  }


  /**
   * Return a Parse Error Response
   * @private
   */
  function _parseError() {
    return callback(
      new Error("5004|Could Not Parse Transit Data|The NYSTA Status Feed did not return a valid response.  This may be temporary so try again later.")
    );
  }

}


/**
 * Parse the NYSTA Service Feed XML into a Transit Feed
 * @param {string} xml NYSTA Service Feed XML
 * @param {function} callback Callback function(feed)
 * @private
 */
function _parse(xml, callback) {
  parseXML(xml, function(err, result) {
    if ( err || !result || !result.events ) {
      return callback();
    }

    // Get the events
    let events = result.events.event ? result.events.event : [];

    // Parse the Timestamp
    let timestamp = result.events.lastupdatetime[0];
    let updated = new Date(Date.parse(timestamp));

    // Create the Feed
    let feed = new TransitFeed(updated);

    // Create the Divisions (with lines set)
    feed.divisions = _createDivisions();

    // Add Events to Feed
    feed = _parseEvents(feed, events);

    // Return the Feed
    return callback(feed);

  });
}


/**
 * Create the Divisions (with Lines set)
 * @returns {TransitDivision[]} List of Transit Divisions
 * @private
 */
function _createDivisions() {

  // Divisions to Return
  let regions = [];

  // Parse the regions from the config
  for ( let i = 0; i < CONFIG.regions.length; i++ ) {

    // CREATE TOP-LEVEL DIVISION FROM REGION
    let region = new TransitDivision(
      CONFIG.regions[i].code,
      CONFIG.regions[i].name,
      CONFIG.regions[i].icon
    );

    // Get the region's highways
    let highways = [];
    for ( let j = 0; j < CONFIG.regions[i].highways.length; j++ ) {
      let highwayCode = CONFIG.regions[i].highways[j];

      // Find Highway Definition
      for ( let k = 0; k < CONFIG.highways.length; k++ ) {
        if ( highwayCode === CONFIG.highways[k].code ) {

          // CREATE 2ND-LEVEL DIVISION FROM HIGHWAY
          let highway = new TransitDivision(
            CONFIG.highways[k].code,
            CONFIG.highways[k].name,
            CONFIG.highways[k].backgroundColor,
            CONFIG.highways[k].textColor
          );

          // Set default status
          highway.status = "No Alerts";

          // Add highway to list of region highways
          highways.push(highway);

        }
      }

    }

    // Add the highways to the region's divisions
    region.divisions = highways;

    // Add the region to the List
    regions.push(region);
  }

  // Return the regions
  return regions;

}


/**
 * Parse NYSTA Events and add to Transit Feed
 * @param {TransitFeed} feed Transit Feed
 * @param {Object[]} events List of NYSTA Events
 * @returns {TransitFeed}
 * @private
 */
function _parseEvents(feed, events) {

  // Parse Each Event
  if ( events ) {
    for ( let i = 0; i < events.length; i++ ) {
      let event = events[i]['$'];

      // Format Title
      let title = _title(event['eventtype']);

      // Format Description
      let description = event['eventdesc'].replace(event['eventtype'] + ", ", "");

      // Set HTML Style
      let style = "<style>";
      style += "@font-face {font-family: 'Material Icons'; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/s/materialicons/v36/flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ.woff2) format('woff2');} .material-icons {font-family: 'Material Icons'; font-weight: normal; font-style: normal;}";
      style += "</style>";

      // Set Details HTML
      let details = style;
      details += "<div class='event-details-description'>" + description + "</div>";
      details += "<div class='event-details-info'>"
      details += "<p><strong>Milepost:</strong> " + event['milepost'] + "</p>";
      details += "<p><strong>Posted:</strong> " + event['updatetime'] + "</p>";
      details += "<p><strong>Until:</strong> " + event['expirationdatetime'] + "</p>";
      details += "<p><strong>Location:</strong> ";
      details += "<a href='https://www.google.com/maps/search/?api=1&query=" + event['latitude'] + "," + event['longitude'] + "&zoom=15&layer=traffic' target='_blank'>";
      details += event['latitude'] + ", " + event['longitude'];
      details += "</a></p>";
      details += "</div>";

      // Create Event
      let te = new TransitEvent(title, details);

      // Add Event to Feed
      feed = _addEventToFeed(feed, te, event);

    }
  }

  // Return the Feed
  return feed;

}


/**
 * Add the Transit Event to the Transit Feed
 * @param {TransitFeed} feed Transit Feed
 * @param {TransitEvent} transitEvent Transit Event
 * @param {Object} eventProps NYSTA Event Properties
 * @returns {TransitFeed}
 * @private
 */
function _addEventToFeed(feed, transitEvent, eventProps) {

  // Find matching region
  let regionCode = eventProps['region'];
  for ( let j = 0; j < feed.divisions.length; j++ ) {

    // Region Matches....
    if ( feed.divisions[j].code === regionCode ) {

      // Find matching highway
      let route = eventProps['route'];
      let routeCode = route.indexOf('-') > -1 ? route.substr(route.lastIndexOf('-')) : route;
      let direction = eventProps['direction'];
      let directionCode = "";
      if ( direction.toLowerCase().indexOf("north") > -1 ) {
        directionCode = "N";
      }
      else if ( direction.toLowerCase().indexOf("east") > -1 ) {
        directionCode = "E";
      }
      else if ( direction.toLowerCase().indexOf("south") > -1 ) {
        directionCode = "S";
      }
      else if ( direction.toLowerCase().indexOf("west") > -1 ) {
        directionCode = "W";
      }

      // Parse the region's highways
      for ( let k = 0; k < feed.divisions[j].divisions.length; k++ ) {
        let name = feed.divisions[j].divisions[k].name;
        let nameCode = name.indexOf('-') > -1 ? name.substr(name.lastIndexOf("-")) : name;
        let dir = name.substr(name.lastIndexOf('('));

        // Highway Division Matches...
        if ( nameCode.toLowerCase().indexOf(routeCode.toLowerCase()) > -1 ) {
          if ( dir.indexOf(directionCode) !== -1 ) {

            // Set Status
            let current = feed.divisions[j].divisions[k].status;
            let status = eventProps['category'].toUpperCase();
            if ( !current || current === "No Alerts" || current === "ROADWORK" ) {
              feed.divisions[j].divisions[k].status = status;
            }

            // Add Event to Line
            feed.divisions[j].divisions[k].events.push(transitEvent);

          }
        }
      }

    }
  }

  // Return the Feed
  return feed;

}


/**
 * Download the MTA Status Feed
 * @param callback Callback function(body)
 * @private
 */
function _download(callback) {

  // Make the get request
  https.get(CONFIG.url, function(response) {
    let body = "";
    response.on("data", function(data) {
      body += data;
    });
    response.on("end", function() {
      body = body.toString();
      return callback(body);
    });
  }).on('error', function(err) {
    console.error(err);
    return callback();
  });

}


/**
 * Convert a string to Title Case
 * @param {String} str String to convert
 * @returns {String}
 */
function _title(str) {
  return str.toLowerCase().split(' ').map(function(word) {
    return word.replace(word[0], word[0].toUpperCase());
  }).join(' ');
}

module.exports = loadFeed;
