(function() {

  var requestAnimFrame = (function(){
    return  window.requestAnimationFrame       || 
            window.webkitRequestAnimationFrame || 
            window.mozRequestAnimationFrame    || 
            window.oRequestAnimationFrame      || 
            window.msRequestAnimationFrame     || 
            function(/* function */ callback, /* DOMElement */ element){
              window.setTimeout( callback, 1000 / 60);
            };
  })();

  var removeClass = function( element, name ) {
    var classes = element.className.split( " " ),
        idx = classes.indexOf( name );
    if ( idx > -1 ) {
      classes.splice( idx, 1 );
    }
    element.className = classes.join( " " );
  }; //removeClass

  var addClass = function( element, name ) {
    var classes = element.className.split( " " ),
        idx = classes.indexOf( name );
    if ( idx === -1 ) {
      element.className += name + " ";
    }
  }; //addClass

  var vimeoUrl = 'http://player.vimeo.com/video/',
      metaDataUrl = 'http://vimeo.com/api/v2/video/';

  var Segment = function( options ) {
    var contentContainer = document.createElement( "div" ),
        videoGuid = options.video,
        froogaloop,
        uuid = Segment.uuid++,
        metaData,
        thumbnail,
        ready = false,
        listeners = {},
        that = this;

    addClass( contentContainer, "video-container" );

    var videoOptions = [
      "title=1",
      "api=1",
      "player_id=" + uuid
    ];

    this.prepare = function( options ) {
      options = options || {};

      var iframe = document.createElement( "iframe" );
      iframe.src = vimeoUrl + videoGuid + "?" + videoOptions.join("&");
      froogaloop = $f( iframe );
      iframe.setAttribute( "frameborder", "0" );
      contentContainer.appendChild( iframe );

      function segmentLoaded() {
        removeListener( "ready", segmentLoaded );
        ready = true;
        if ( options.ready) {
          options.ready();
        }
      }

      addListener( "ready", segmentLoaded );
    }; //prepare

    function getMetaData() {
      var callbackName = "ThreeMosquesVideoCallback" + uuid,
          metaUrl = metaDataUrl + videoGuid + ".json?callback=" + callbackName;

      var head = document.getElementsByTagName('head').item(0),
          script = document.createElement('script');

      script.setAttribute('type', 'text/javascript');
      script.setAttribute('src', metaUrl );

      window[ callbackName ] = function( data ) {
        metaData = data[ 0 ];
        delete window[ callbackName ];
        head.removeChild( script );
        if ( metaData.thumbnail_medium ) {
          thumbnail = new Image();
          thumbnail.src = metaData.thumbnail_medium;
        } //if
        if ( options.metaDataReady ) {
         options.metaDataReady( metaData );
        } //if
      }; //metaData callback

      head.appendChild( script );
    } //getMetaData

    Object.defineProperty( this, "contentElement", { get: function() { return contentContainer; } } );
    Object.defineProperty( this, "description", { get: function() { return metaData.description; } } );
    Object.defineProperty( this, "title", { get: function() { return metaData.title; } } );
    Object.defineProperty( this, "duration", { get: function() { return metaData.duration; } } );
    Object.defineProperty( this, "ready", { get: function() { return ready; } } );
    Object.defineProperty( this, "user", { get: function() { return metaData.user; } } );
    Object.defineProperty( this, "metaData", { get: function() { return metaData; } } );
    Object.defineProperty( this, "width", { get: function() { return metaData.width; } } );
    Object.defineProperty( this, "height", { get: function() { return metaData.height; } } );

    var addListener = this.addListener = function( name, listener ) { 
      if ( !listeners[ name ] ) {
        listeners[ name ] = [];
        froogaloop.addEvent( name, function( data ) {
          var theseListeners = listeners[ name ];
          for ( var i=0, l=theseListeners.length; i<l; ++i ) {
            theseListeners[ i ]( data );
          } //for
        });
      } //if
      listeners[ name ].push( listener );
    }; //addListener

    var removeListener = this.removeListener = function( name, listener ) {
      if ( listeners[ name ] ) {
        var theseListeners = listeners[ name ],
            idx = theseListeners.indexOf( listener );
        if ( idx > -1 ) {
          theseListeners.splice( idx, 1 );
        }
        if ( theseListeners.length === 0 ) {
          froogaloop.removeEvent( name );
        }
      } //if
    }; //removeListener

    this.api = function( name, options ) { froogaloop.api( name, options ); };

    this.hide = function() {
      removeClass( contentContainer, "video-container-on" );
      addClass( contentContainer, "video-container-off" );
    }; //hide

    this.show = function() {
      removeClass( contentContainer, "video-container-off" );
      addClass( contentContainer, "video-container-on" );
    }; //show

    this.play = function( finishedCallback ) {
      froogaloop.api( "play" );
      function check() {
        froogaloop.api( "getCurrentTime", function( time ) {
          if ( time < metaData.duration ) {
            setTimeout( check, 500 );
          }
          else {
            finishedCallback();
          }
        });
      }
      check();
    }; //play

    getMetaData();

  }; //Segment
  Segment.uuid = 0;

  var Timeline = function( options ) {

    var targetContainer = document.getElementById( options.target ),
        descriptionContainer = document.getElementById( options.description ),
        titleContainer = document.getElementById( options.title ),
        audio = document.getElementById( options.audio ),
        segments = [],
        that = this;

    this.addSegment = function( segment ) {
      targetContainer.appendChild( segment.contentElement );
      segment.hide();
      segments.push( segment );
    }; //addSegment

    function prepareSegment( segment, readyCallback ) {
      segment.show();
      segment.prepare({
        ready: readyCallback
      });
    } //prepareSegment

    function playSegment( segment, finishedCallback ) {
      descriptionContainer.innerHTML = segment.description;
      titleContainer.innerHTML = segment.title;
      segment.play( finishedCallback );
    } //playSegment

    this.play = function() {
      var firstSegmentReady = false,
          audioReady = false,
          currentSegment = segments[ 0 ];

      function playNextSegment() {
        var nextSegment = segments[ segments.indexOf( currentSegment ) + 1 ];
        if ( nextSegment ) {
          currentSegment.hide();
          prepareSegment( nextSegment, function() {
            playSegment( nextSegment, playNextSegment ) 
          });
          currentSegment = nextSegment;
        } //if
      } //playNextSegment

      function check() {
        if ( firstSegmentReady && audioReady ) {
          playSegment( currentSegment, playNextSegment );
          audio.play();
        }
        else {
          setTimeout( check, 100 );
        }
      } //check

      function audioLoaded( e ) {
        audioReady = true;
        audio.removeEventListener( 'canplaythrough', audioLoaded, false );
      } //audioReady

      if ( audio.readyState > 0 ) {
        audioLoaded();
      }
      else {
        audio.addEventListener( 'canplaythrough', audioLoaded, false );
      } //if

      prepareSegment( currentSegment, function() {
        firstSegmentReady = true;
      });

      check();

    }; //play

  }; //Timeline

  var Player = function( options ) {
    
  }; //Player

  window.ThirtyMosques = {
    Segment: Segment,
    Timeline: Timeline, 
    Player: Player 
  };

})();
