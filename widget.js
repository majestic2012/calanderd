// (c) totoCZ 2014, Pierre Ynard 2016, 2019
// Original events.js code written by foo.
// Licensed under GPLv3+

// This widget is an alternative web frontend for calendard.
// It requires loading separately the following shared calendard modules:
// websdrs.js, tx.js, events.js, timeutils.js

var events;

function getEvents() {
	// Clean up obsolete cache data. TODO: remove this after a while
	if (typeof(Storage) !== 'undefined') {
		localStorage.removeItem("events");
	}

    var calanderUrl = "http://calendar.priyom.org/events?timeMin=" + (new Date()).toISOString() + "&maxResults=150";

    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", calanderUrl, false);
    xmlHttp.send(null);

	// FIXME: switch to asynchronous XMLHttpRequest to avoid freezing
	// browser, and handle errors
	var json = xmlHttp.responseText;

  var obj = JSON.parse(json);
  events.load(obj.items.map(function(evt) {
    return new TX(evt.summary, new Date(evt.start.dateTime), websdrs, null);
  }));
}

function printEvents(nextEvents) {
  var next = timeutils.humanizeDuration(nextEvents[0].eventDate - new Date());
  var header = "<h3>Next station " + next + "</h3>";

  var items = nextEvents.map(function(evt) {
    var format = evt.format();
    var link = evt.link();
    if (link) {
      format = "<a href='" + link + "'>" + format + "</a>";
    }
    return ("<li>" + format + "</li>");
  });

  return (header + "<ul>" + items.join("") + "</ul>");
}

function cmdNext() {
  var nextEvents = events.getNext(null);
  if (nextEvents == null || events.count() < 3) {
    getEvents();
    nextEvents = events.getNext(null);
  }

  document.getElementById("events").innerHTML = nextEvents != null ? printEvents(nextEvents) : "";
}

document.addEventListener("DOMContentLoaded", function () {
  events = new Events();
  cmdNext();
  setInterval(cmdNext, 60 * 1000);
});
