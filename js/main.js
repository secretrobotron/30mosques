(function() {

  var youtubeReadyCallbacks = [],
      youtubeReady = false;
  window.onYouTubePlayerAPIReady = function() {
    youtubeReady = true;
    if ( youtubeReadyCallbacks.length ) {
      for ( var i=0; i<youtubeReadyCallbacks.length; ++i ) {
        youtubeReadyCallbacks[ i ]();
      } //for
    } //if
  };

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

  function EventManager( object ) {
    var listeners = {};

    var addListener = function( name, listener ) { 
      if ( !listeners[ name ] ) {
        listeners[ name ] = [];
      } //if
      listeners[ name ].push( listener );
    }; //addListener

    var removeListener = function( name, listener ) {
      if ( listeners[ name ] ) {
        var theseListeners = listeners[ name ],
            idx = theseListeners.indexOf( listener );
        if ( idx > -1 ) {
          theseListeners.splice( idx, 1 );
        }
      } //if
    }; //removeListener

    this.dispatchEvent = function( name ) {
      var theseListeners = listeners[ name ];
      if ( theseListeners ) {
        for ( var i=0, l=theseListeners.length; i<l; ++i ) {
          theseListeners[ i ]();
        } //for
      } //if
    } //dispatchEvent

    object.addListener = addListener;
    object.removeListener = removeListener;

  } //EventManager

  function fadeElement( element, from, to, doneCallback ) {
    var opacity = from;
    function doFade() {
      if ( Math.abs( opacity - to ) > 0.01 ) {
        opacity -= ( opacity - to ) * 0.05;
        element.style.opacity = opacity;
        requestAnimFrame( doFade );
      }
      else if ( doneCallback ) {
        element.style.opacity = to;
        doneCallback();
      }
    }
    doFade();
  } //fadeElement

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

  var metaDataUrl = 'http://gdata.youtube.com/feeds/api/videos/';

  var Segment = function( options ) {
    var contentDiv = document.createElement( "div" ),
        chosenVideo = options.videos[ Math.floor( Math.random() * options.videos.length ) ],
        videoId = chosenVideo.url,
        uuid = Segment.uuid++,
        videoPlayerId = "segment-video-" + uuid,
        metaData,
        thumbnail,
        popcorn,
        ready = false,
        backgroundVolume = chosenVideo.backgroundVolume,
        videoPlayer,
        volume = chosenVideo.volume || 1,
        eventManager = new EventManager( this ),
        that = this;

    var playerVars = {
      controls: 0,
      showinfo: 0 ,
      modestbranding: 1,
      wmode: "transparent"
    };
    if ( chosenVideo.start ) {
      playerVars.start = chosenVideo.start;
    }
    if ( chosenVideo.end ) {
      playerVars.end = chosenVideo.end;
    }

    contentDiv.id = "video-container-" + uuid;
    contentDiv.style.opacity = 0;

    addClass( contentDiv, "video-container" );

    this.prepare = function( options ) {
      options = options || {};

      function init() {
        removeClass( contentDiv, "video-container-off" );
        removeClass( contentDiv, "video-container-on" );
        addClass( contentDiv, "video-container-loading" );

        videoPlayer = new YT.Player( contentDiv.id, {
          height: '390',
          width: '640',
          videoId: videoId,
          playerVars: playerVars,
          events: {
            'onReady': segmentLoaded
          }
        });

        function segmentLoaded() {
          videoPlayer.setVolume( 0 );
          videoPlayer.playVideo();
          videoPlayer.addEventListener( "onStateChange", function( e ) {
            if ( ready === false && e.data === 2 ) {
              ready = true;
              eventManager.dispatchEvent( "ready" );
            } //if
          });
          videoPlayer.pauseVideo();
        }
      } //init

      if ( !youtubeReady ) {
        youtubeReadyCallbacks.push( init );
      }
      else {
        init();
      } //if
    }; //prepare

    function getMetaData() {
      var callbackName = "ThreeMosquesVideoCallback" + uuid,
          metaUrl = metaDataUrl + videoId + "?v=2&alt=json-in-script&callback=" + callbackName;

      var head = document.getElementsByTagName('head').item(0),
          script = document.createElement('script');

      script.setAttribute('type', 'text/javascript');
      script.setAttribute('src', metaUrl );

      window[ callbackName ] = function( data ) {
        var mediaData = data.entry;
        metaData = {
          description: mediaData.media$group.media$description.$t,
          duration: mediaData.media$group.yt$duration.seconds,
          title: mediaData.title.$t,
          user: mediaData.author[ 0 ].name,
          thumbnailUrl: mediaData.media$group.media$thumbnail[ 0 ].url
        };
        delete window[ callbackName ];
        head.removeChild( script );
        if ( metaData.thumbnailUrl ) {
          thumbnail = new Image();
          thumbnail.src = metaData.thumbnailUrl;
        } //if
        if ( options.metaDataReady ) {
         options.metaDataReady( metaData );
        } //if
      }; //metaData callback

      head.appendChild( script );
    } //getMetaData

    Object.defineProperty( this, "contentElement", { get: function() { return contentDiv; } } );
    Object.defineProperty( this, "description", { get: function() { return metaData.description; } } );
    Object.defineProperty( this, "title", { get: function() { return metaData.title; } } );
    Object.defineProperty( this, "duration", { get: function() { return metaData.duration; } } );
    Object.defineProperty( this, "ready", { get: function() { return ready; } } );
    Object.defineProperty( this, "user", { get: function() { return metaData.user; } } );
    Object.defineProperty( this, "metaData", { get: function() { return metaData; } } );
    Object.defineProperty( this, "backgroundVolume", { get: function() { return backgroundVolume; } } );
    Object.defineProperty( this, "volume", { get: function() { return volume; } } );

    this.hide = function( fadeAudio ) {
      if ( fadeAudio ) {
        var currentVolume = volume;
        function doFadeAudio() {
          if ( currentVolume > 0.1 ) {
            currentVolume -= currentVolume *.25;
            setTimeout( doFadeAudio, 50 );
          }
          videoPlayer.setVolume( currentVolume*100 );
        }
        doFadeAudio();
      } //if
      if ( contentDiv.style.opacity > 0 ) {
        fadeElement( contentDiv, 1, 0, function() {
          removeClass( contentDiv, "video-container-on" );
          addClass( contentDiv, "video-container-off" );
          removeClass( contentDiv, "video-container-loading" );
        });
      }
    }; //hide

    this.show = function() {
      removeClass( contentDiv, "video-container-loading" );
      removeClass( contentDiv, "video-container-off" );
      addClass( contentDiv, "video-container-on" );
    }; //show

    this.play = function() {
      var currentVolume = 0;
      function doFadeAudio() {
        if ( currentVolume < volume - 0.15 ) {
          currentVolume -= ( currentVolume - volume ) *.1;
          setTimeout( doFadeAudio, 50 );
        }
        videoPlayer.setVolume( currentVolume*100 );
      } //doFadeAudio

      videoPlayer.setVolume( volume*100 );
      videoPlayer.playVideo();
      function check() {
        var time = videoPlayer.getCurrentTime();
        if ( chosenVideo.end && time < chosenVideo.end && time < metaData.duration ) {
          setTimeout( check, 500 );
        }
        else {
          eventManager.dispatchEvent( "finished" );
        }
      }
      check();
      fadeElement( contentDiv, 0, 1 );
      doFadeAudio();
    }; //play

    this.stop = function() {
      videoPlayer.stopVideo();
    }; //stop

    getMetaData();

  }; //Segment
  Segment.uuid = 0;

  var Transition = function( options ) {
    var contentDiv = document.createElement( "div" ),
        backgroundVolume = options.backgroundVolume || 1,
        autoEnd = false,
        playInterval,
        voiceoverAudio,
        eventManager = new EventManager( this ),
        ready = false,
        uuid = Transition.uuid++,
        popcornImageSelection = [],
        popcorn,
        transitionImage,
        voiceoverDuration,
        that = this;

    if ( options.voiceover ) {
      voiceoverDuration = options.voiceover.end - options.voiceover.start;
    } //if

    contentDiv.id = "transition-container-" + uuid;
    addClass( contentDiv, "transition-container" );

    Object.defineProperty( this, "contentElement", { get: function() { return contentDiv; } } );
    Object.defineProperty( this, "backgroundVolume", { get: function() { return backgroundVolume; } } );
    Object.defineProperty( this, "voiceoverAudio", { set: function( val ) { voiceoverAudio = val; } } );
    Object.defineProperty( this, "ready", { get: function() { return ready; } } );
    Object.defineProperty( this, "title", { get: function() { return options.title; } } );
    Object.defineProperty( this, "popcorn", { set: function( val ) { popcorn = val; } } );

    this.addPopcornImage = function( eventOptions ) {
      popcornImageSelection.push( eventOptions );
    }; //addPopcornImage

    this.addPopcornEvent = function( eventType, eventOptions ) {
      if ( eventOptions.start !== undefined ) {
        eventOptions.start += options.voiceover.start + 0.1;
      }
      if ( eventOptions.end !== undefined ) {
        eventOptions.end += options.voiceover.start + 5;
      }
      if ( !eventOptions.target ) {
        eventOptions.target = "transition-container-" + uuid;
      }
      popcorn[ eventType ]( eventOptions );
    }; //addPopcornEvent

    this.prepare = function( prepareOptions ) {
      contentDiv.style.opacity = 0;
      addClass( contentDiv, "transition-container-loading" );
      if ( options.voiceover ) {
        popcorn = Popcorn( voiceoverAudio );
        popcorn.currentTime( options.voiceover.start );
      }
      if ( options.prepare ) {
        options.prepare( that );
      }
      if ( popcornImageSelection.length > 0 ) {
        var selected = popcornImageSelection[ Math.floor( popcornImageSelection.length * Math.random() ) ];
        var eventObj = {
          src: selected,
          start: 0,
          end: voiceoverDuration 
        };
        that.addPopcornEvent( "image", eventObj );
        var trackEvent = popcorn.getTrackEvent( popcorn.getLastTrackEventId() );
        
        function readyCheck() {
          if ( trackEvent.link.getElementsByTagName( "img" ).length === 0 ) {
            setTimeout( readyCheck, 100 );
          }
          else {
            var image = trackEvent.link.getElementsByTagName( "img" )[ 0 ];
            image.style.width = contentDiv.offsetWidth + "px";
            transitionImage = image;
            ready = true;
            eventManager.dispatchEvent( "ready" );
          }
        }
        readyCheck();
      }
      else {
        ready = true;
        eventManager.dispatchEvent( "ready" );
      }
    }; //prepare

    this.hide = function() {
      if ( contentDiv.style.opacity > 0 ) {
        fadeElement( contentDiv, 1, 0, function() {
          removeClass( contentDiv, "transition-container-on" );
          removeClass( contentDiv, "transition-container-loading" );
          addClass( contentDiv, "transition-container-off" );
        });
      }
    }; //hide

    this.show = function() {
      removeClass( contentDiv, "transition-container-off" );
      removeClass( contentDiv, "transition-container-loading" );
      addClass( contentDiv, "transition-container-on" );
    }; //show

    function startUpdate() {
      function doUpdate() {
        if ( autoEnd !== false && popcorn.currentTime() >= autoEnd ) {
          that.end();
        }
        if ( options.update ) {
          options.update( that );
        }
      }
      playInterval = setInterval( doUpdate, 30 );
    } //update

    function stopUpdate() {
      if ( playInterval ) {
        clearInterval( playInterval );
      }
    } //stopUpdate

    this.autoEnd = function() {
      var realEnding = options.voiceover.end;
      if ( options.voiceover.extend ) {
        realEnding -= options.voiceover.extend;
      }
      autoEnd = realEnding;
    }; //autoEnd

    this.play = function() {
      fadeElement( contentDiv, 0, 1 );
      popcorn.currentTime( options.voiceover.start );
      popcorn.play();
      options.run( that );
      startUpdate();
    }; //play

    this.end = function() {
      if ( options.voiceover.extend ) {
        setTimeout( function() {
          popcorn.pause();
        }, options.voiceover.extend*1000 );
      }
      else {
        popcorn.pause();
      }
      stopUpdate();
      eventManager.dispatchEvent( "finished" );
    }; //end

  }; //Transition
  Transition.uuid = 0;

  var AudioTweener = function( audio ) {

    var tweening = false,
        target = 1;

    function doTween( to ) {
      if ( Math.abs( audio.volume - target ) > 0.01 ) {
        audio.volume = audio.volume - ( audio.volume - target ) * .01;
        requestAnimFrame( doTween );
      }
      else {
        tweening = false;
      } //if
    } //tweenAudioVolume

    this.tween = function( to ) {
      target = to;
      if ( !tweening ) {
        tweening = true;
        doTween( to );
      } //if
    }; //tween

  }; //AudioTweener

  var Timeline = function( options ) {

    var targetContainer = document.getElementById( options.target ),
        descriptionContainer = document.getElementById( options.description ),
        titleContainer = document.getElementById( options.title ),
        audio = document.getElementById( options.audio ),
        voiceoverAudio = document.getElementById( options.voiceover ),
        segments = [],
        audioTweener = new AudioTweener( audio ),
        currentSegment,
        loadingSegment,
        popcorn = Popcorn( voiceoverAudio ),
        that = this;

    this.addTransition = function( transition ) {
      targetContainer.appendChild( transition.contentElement );
      transition.popcorn = popcorn;
      transition.hide();
      segments.push( transition );
      transition.voiceoverAudio = voiceoverAudio;
    }; //addTransition

    this.addSegment = function( segment ) {
      targetContainer.appendChild( segment.contentElement );
      segment.hide();
      segments.push( segment );
    }; //addSegment

    function getNextSegment() {
      var nextSegment;
      if ( currentSegment ) {
        nextSegment = segments[ segments.indexOf( currentSegment ) + 1 ];
      }
      else {
        nextSegment = segments[ 0 ];
      } //if
      return nextSegment;
    } //getNextSegment

    function segmentFinished() {
      currentSegment.hide( true );
      currentSegment.removeListener( "finished", segmentFinished );
      playNext();
    } //segmentFinished

    function playNext() {
      var nextSegment = getNextSegment();
      function ready() {
        currentSegment = nextSegment;
        currentSegment.addListener( "finished", segmentFinished );
        descriptionContainer.innerHTML = currentSegment.description;
        titleContainer.innerHTML = currentSegment.title;
        currentSegment.show();
        currentSegment.play();
        audioTweener.tween( currentSegment.backgroundVolume*.75 );
        currentSegment.removeListener( "ready", ready );
        setTimeout( function() {
          var nextSegment = getNextSegment();
          if ( nextSegment ) {
            nextSegment.prepare();
          }
        }, 1000 );
      }
      if ( nextSegment ) {
        if ( nextSegment.ready ) {
          ready();
        }
        else {
          nextSegment.addListener( "ready", ready );
        } //if
      } //if
    } //playNext

    this.play = function() {
      var firstSegmentReady = false,
          audioReady = 0,
          currentSegment = segments[ 0 ],
          cuedSegment;

      function audioLoaded( e ) {
        ++audioReady;
        if ( e ) {
          e.target.removeEventListener( 'canplaythrough', audioLoaded, false );
        } //if
        if ( audioReady === 2 ) { 
          var nextSegment = getNextSegment();
          if ( nextSegment ) {
            nextSegment.addListener( "ready", function() {
              playNext();
              audio.play();
            });
            nextSegment.prepare();
          } //if
        } //if
 
      } //audioReady

      if ( audio.readyState > 0 ) {
        audioLoaded();
      }
      else {
        audio.addEventListener( 'canplaythrough', audioLoaded, false );
      } //if

      if ( voiceoverAudio.readyState > 0 ) {
        audioLoaded();
      }
      else {
        voiceoverAudio.addEventListener( 'canplaythrough', audioLoaded, false );
      } //if

    }; //play

  }; //Timeline

  var Player = function( options ) {
    
  }; //Player

  window.ThirtyMosques = {
    Segment: Segment,
    Timeline: Timeline, 
    Transition: Transition,
    Player: Player 
  };

})();
