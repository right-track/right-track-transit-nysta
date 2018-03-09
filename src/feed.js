'use strict';

const http = require('http');
const parseXML = require('xml2js').parseString;
const props = require('../agency.json');

const TF = require('right-track-transit/src/TransitFeed');
const TransitFeed = TF.TransitFeed;
const TransitDivision = TF.TransitDivision;
const TransitLine = TF.TransitLine;
const TransitEvent = TF.TransitEvent;


// Feed Cache
let CACHE = undefined;
let CACHE_UPDATED = new Date(0);


/**
 * Load the NYSTA Transit Feed
 * @param {function} callback Callback function
 * @param {Error} callback.error Transit Feed Error. The Error's message will be a pipe (|) separated
 * string in the format of: Error Code|Error Type|Error Message that will be parsed out by the Right
 * Track API Server into a more specific error Response.
 * @param {TransitFeed} [callback.feed] The built Transit Feed for NYSTA
 */
function loadFeed(callback) {

  // Return Cached Feed
  if ( CACHE !== undefined &&
    CACHE_UPDATED.getTime() >= (new Date().getTime() - (props.maxCache*1000)) ) {
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


// TODO: Create separate line definitions for each division/region


/**
 * Create the Divisions (with Lines set)
 * @returns {TransitDivision[]} List of Transit Divisions
 * @private
 */
function _createDivisions() {

  // Load the Transit Agency
  const TA = require('./index.js');

  // Divisions to Return
  let divisions = [];

  // Parse the divisions from the config
  for ( let i = 0; i < props.divisions.length; i++ ) {

    // CREATE DIVISION
    let div = new TransitDivision(
      props.divisions[i].code,
      props.divisions[i].name,
      TA.getDivisionIconPath(props.divisions[i].code)
    );

    // Get the Division's Lines
    let divLines = [];
    for ( let j = 0; j < props.divisions[i].lines.length; j++ ) {
      let lineCode = props.divisions[i].lines[j];

      // Find Line Definition
      for ( let k = 0; k < props.lines.length; k++ ) {
        if ( lineCode === props.lines[k].code ) {

          // CREATE LINE
          divLines.push(
            new TransitLine(
              props.lines[k].code,
              props.lines[k].name,
              props.lines[k].backgroundColor,
              props.lines[k].textColor
            )
          );

        }
      }

    }

    // Add the Lines to the Division
    div.lines = divLines;

    // Add the Division to the List
    divisions.push(div);
  }

  // Return the Divisions
  return divisions;

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
      let title = event['eventtype'].toUpperCase();

      // Format Details
      let description = event['eventdesc'].replace(event['eventtype'] + ", ", "");
      let details = "<h4>" + description + "</h4>";
      details += "<hr />";
      details += "<p style='opacity: 0.8'>";
      details += "<strong>Milepost:</strong> " + event['milepost'] + "<br />";
      details += "<strong>Posted:</strong> " + event['updatetime'] + "<br />";
      details += "<strong>Until:</strong> " + event['expirationdatetime'] + "<br />";
      details += "<strong>Location:</strong> " + event['lat'] + ", " + event['lon'];
      details += "</p>";

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

  // Find matching division
  let divCode = eventProps['region'];
  for ( let j = 0; j < feed.divisions.length; j++ ) {

    // Division Matches....
    if ( feed.divisions[j].code === divCode ) {

      // Find matching line
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

      // Parse the Division's Lines
      for ( let k = 0; k < feed.divisions[j].lines.length; k++ ) {
        let name = feed.divisions[j].lines[k].name;
        let nameCode = name.indexOf('-') > -1 ? name.substr(name.lastIndexOf("-")) : name;
        let dir = name.substr(name.lastIndexOf('('));

        // Line Matches...
        if ( nameCode.toLowerCase().indexOf(routeCode.toLowerCase()) > -1 ) {
          if ( dir.indexOf(directionCode) !== -1 ) {

            // Add Event to Line
            feed.divisions[j].lines[k].events.push(transitEvent);

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
  http.get(props.url, function(response) {
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


module.exports = loadFeed;