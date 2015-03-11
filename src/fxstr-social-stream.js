'use strict';

angular
.module( 'fxstr.socialStream', [] )
.directive( 'socialStream', [ function() {

	return {
		link			: function( scope, element, attrs, ctrl ) {
			ctrl.init( element );
		}
		, controller	: 'SocialStreamDirectiveController'
		, scope			: {
			// ID/url of the page to be called
			socialStreamFacebookPage		: '='
			// URL of the php proxy file
			, socialStreamFacebookProxy		: '='
			// To generate id, see here: https://cdn.syndication.twimg.com/widgets/timelines/69093174?lang=en&callback=twitterFetcher.callback&suppress_response_codes=true&rnd=123123
			, socialStreamTwitterId			: '='
			, socialStreamInstagramToken	: '='
			, socialStreamInstagramUserId	: '='
		}
		, templateUrl	: 'socialStreamTemplate'
	};

} ] )


.controller( 'SocialStreamDirectiveController', [ '$scope', '$q', '$attrs', 'FacebookStreamService', 'TwitterStreamService', 'InstagramStreamService', function( $scope, $q, $attrs, FacebookStreamService, TwitterStreamService, InstagramStreamService ) {

	var self		= this
		, element;

	$scope.posts = [];

	// Status per social network. May be
	// 0: Not initialized
	// 1: loading
	// 2: loaded
	$scope.status = {
		facebook		: 0
		, twitter		: 0
		, instagram		: 0
	}

	self.init = function( el ) {
		element = el;
	}

	// #todo: remove old posts when getting new ones
	$scope.$watchGroup( [ 'socialStreamFacebookPage', 'socialStreamFacebookProxy' ], function( newValue ) {
		
		var fbProxyUrl	= $scope.socialStreamFacebookProxy
			, fbPage	= $scope.socialStreamFacebookPage;


		if( !fbProxyUrl || !fbPage ) {
			console.log( 'FB: not yet ready %o %o', fbProxyUrl, fbPage );
			return;
		}

		$scope.status.facebook = 1;

		FacebookStreamService.getPosts( fbProxyUrl, fbPage )
			.then( function( fbPosts ) {
				$scope.status.facebook		= 2;
				$scope.posts				= $scope.posts.concat( fbPosts );
			}, function( err ) {
				console.error( err );
			} );

	} );


	$scope.$watch( 'socialStreamTwitterId', function( newValue ) {

		if( !newValue ) {
			return;
		}

		$scope.status.twitter = 1;
		
		TwitterStreamService.getPosts( newValue )
			.then( function( twrPosts ) {
				$scope.status.twitter = 2;
				$scope.posts = $scope.posts.concat( twrPosts );
			}, function( err ) {
				console.error( err );
			} );

	} );


	$scope.$watchGroup( [ 'socialStreamInstagramToken', 'socialStreamInstagramUserId' ], function( newValue ) {

		if( !newValue[ 0 ] || !newValue[ 1 ] ) {
			return;
		}

		$scope.status.instagram = 1;

		InstagramStreamService.getPosts( newValue[ 0 ], newValue[ 1 ] )
			.then( function( igrPosts ) {
				$scope.status.instagram = 2;
				$scope.posts = $scope.posts.concat( igrPosts );
			}, function( err ) {
				console.error( err );
			} );

	} );

} ] )

.factory( 'FacebookStreamService', [ '$http', '$q', function( $http, $q ) {

	var typeIdentifier		= 'facebook'
		, baseUrl			= 'https://graph.facebook.com/v2.2/';



	function parsePost( originalPost, fbProxyUrl, fbPage ) {

		var post = new Post();
		parsePostBase( originalPost, post, fbProxyUrl, fbPage );
	
		if( originalPost.type === 'photo' ) {
			parsePhoto( originalPost, post );
		}
		else if( originalPost.type === 'video' ) {
			parseVideo( originalPost, post );
		}
		else if( originalPost.type === 'link' ) {
			parseLink( originalPost, post );
		}
		else {
			console.error( 'Unknown FB post type: %o', originalPost.type );
		}

		return post;

	}

	/**
	* Parses post's standard information
	*/
	function parsePostBase( originalPost, post, fbProxyUrl, fbPage ) {


		// Remove +0000 from date. Date returned by created_time won't be parsed by Safari into valid
		// date
		post.publishDate	= new Date( originalPost.created_time.replace( /\+\d{4,4}$/, '' ) );

		console.error( originalPost );

		post.link			= originalPost.link;
		post.originalLink	= 'http://facebook.com/' + originalPost.id.split( '_' )[ 0 ] + '/posts/' + originalPost.id.split( '_' )[ 1 ];
		post.source			= typeIdentifier;
		post.type			= originalPost.type;

		// author
		var author			= new PostAuthor();
		author.name			= originalPost.from.name;
		author.link			= 'http://facebook.com/' + originalPost.from.id;
		post.author			= author;

		// Use promise to update post.actions, as only this solution will
		// propagate to the frontend
		parseLikes( originalPost, post, fbProxyUrl, fbPage ).then( function( likeObj ) {
			post.actions.push( likeObj );
		} );
		parseComments( originalPost, post );

	}


	function parseLikes( originalPost, post, fbProxyUrl, fbPage ) {

		var deferred = $q.defer();

		$http.get( fbProxyUrl, {
			params				: {
				entity			: originalPost.id + '/likes'
				, facebookPage	: fbPage
			}
		} )
		.then( function( response ) {

			if( !response || !response.data || !response.data.summary ) {
				return $q.reject( 'Could not get like data: %o', response );
			}

			// Directly add likeObj to post.actions – will update through reference
			var likeObj			= new PostAction();
			likeObj.count		= response.data.summary.total_count;
			likeObj.name		= 'like';

			deferred.resolve( likeObj );

		}, function( err ) {

			console.error( 'FacebookStreamService: Could not get likes: %o', err );

		} );

		return deferred.promise;

	}


	function parseComments( originalPost, post ) {

		if( !originalPost.comments || !originalPost.comments.data || !originalPost.comments.data.length ) {
			return;
		}

		var commentObj = new PostAction();

		commentObj.name		= 'comment';
		commentObj.count	= originalPost.comments.data.length;
		post.actions.push( commentObj );

	}


	function parseLink( originalPost, post ) {

		post.title		= parseMessage( originalPost.message, originalPost.message_tags );
		post.text		= originalPost.description;

	}



	function parseVideo( originalPost, post ) {

		// PICTURE
		// See parsePhoto
		if( originalPost.object_id ) {
			post.image	= 'https://graph.facebook.com/' + originalPost.object_id + '/picture'
		}
		// get objectId from link property, looks like https://www.facebook.com/video.php?v=714971548622550
		else if( post.link && /v=\d*/.test( post.link ) ) {
			var objectId = /v=(\d*)$/.exec( post.link )[ 1 ];
			post.image = 'https://graph.facebook.com/' + objectId + '/picture';
		}
		else {
			post.image	= originalPost.picture;
		}

		// TEXT
		post.title		= '';
		if( originalPost.description ) {
			post.title	+= originalPost.description + ' ';
		}
		if( originalPost.message ) {
			post.title	+= parseMessage( originalPost.message, originalPost.message_tags );
		}

	}


	function parsePhoto( originalPost, post ) {

		post.title			= parseMessage( originalPost.message, originalPost.message_tags );

		// originalPost.picture is tiny. Get the larger version by using http://stackoverflow.com/questions/7599638/how-to-get-large-photo-url-in-one-api-call
		// See parseVideo
		if( originalPost.object_id ) {
			post.image		= 'https://graph.facebook.com/' + originalPost.object_id + '/picture'
		}
		else {
			post.image		= originalPost.picture;
		}

	}


	function parseMessage( message, tagObject ) {

		// Flatten tags
		var tags = [];
		for( var i in tagObject ) {

			if( !tagObject[ i ].length ) {
				continue;
			}

			for( var j = 0; j < tagObject[ i ].length; j++ ) {
				tags.push( tagObject[ i ][ j ] );
			}
		}

		// Sort tags: start replacing text from the end
		// Tag with highest offset should have index 0
		tags.sort( function( a, b ) {
			return a.offset > b.offset ? -1 : 1;
		} );

		for( var i = 0; i < tags.length; i++ ) {
			var tag = tags[ i ];
			message = message.substr( 0, tag.offset ) + '<a href=\'http://facebook.com/' + tag.id  + '\'>' + message.substr( tag.offset, tag.length ) + '</a>' + message.substr( tag.offset + tag.length );
		}

		return message;

	}


	return {

		getPosts: function( fbProxyUrl, fbPage ) {

			var posts = [];

			return $http.get( fbProxyUrl, {
				params				: {
					facebookPage	: fbPage
				}
			} )
			.then( function( response ) {

				if( !response || !response.data || !response.data.data || !response.data.data.length ) {
					return $q.reject( 'Facebook response not valid' );
				}

				for( var i = 0; i < response.data.data.length; i++ ) {
					var parsedPost = parsePost( response.data.data[ i ], fbProxyUrl, fbPage );
					posts.push( parsedPost );
				}

				return posts;

			}, function( err ) {
				return $q.reject( err );
			} );

		}
	};

} ] )









.service( 'TwitterStreamService', [ '$http', '$q', function( $http, $q ) {

	// Get posts from twimg – thanks, https://github.com/jasonmayes/Twitter-Post-Fetcher/blob/master/js/twitterFetcher.js
	//https://cdn.syndication.twimg.com/widgets/timelines/69093174?lang=en&callback=twitterFetcher.callback&suppress_response_codes=true&rnd=123123


	function parseTweet( originalTweet ) {

		var post			= new Post();

		post.source			= 'twitter';
		post.title			= originalTweet.find( '.e-entry-title' ).html();
		post.publishDate	= new Date( originalTweet.find( '.header time' ).attr( 'datetime' ).replace( /\+\d{4,4}$/, '' ) );

		post.author			= parseAuthor( originalTweet, post );
		post.originalLink	= post.author.link + '/status/' + originalTweet.data( 'tweetId' )

		post.actions		= post.actions.concat( parseActions( originalTweet ) );

		return post;


	}

	function parseAuthor( originalTweet ) {

		var author			= new PostAuthor();
		author.name			= originalTweet.find( '.p-name' ).text();
		author.nickName		= originalTweet.find( '.p-nickname' ).text();
		author.link			= 'http://twitter.com/' + author.nickName.substr( 1 );
		author.image		= originalTweet.find( '.u-photo.avatar' ).attr( 'src' );

		return author;

	}

	function parseActions( originalTweet ) {

		var ret			= [];

		// Favorites
		var fav				= new PostAction();
		fav.name			= 'favorite';
		fav.count			= originalTweet.find( '.stats-favorites:first strong' ).length > 0 ? parseInt( originalTweet.find( '.stats-favorites:first strong' ).text(), 10) : 0;
		fav.link			= originalTweet.find( '.tweet-actions a[title=Favorite]' ).attr( 'href' );
		ret.push( fav );

		// Retweets
		var retweet			= new PostAction();
		retweet.name		= 'retweet';
		retweet.count		= originalTweet.find( '.stats-retweets:first strong').length > 0 ? parseInt( originalTweet.find( '.stats-retweets:first strong').text() ) : 0;
		retweet.link		= originalTweet.find( '.tweet-actions a[title=Retweet]' ).attr( 'href' );
		ret.push( retweet);

		return ret;

	}




	return {
		getPosts: function( twitterUserId ) {

			var baseUrl = 'https://cdn.syndication.twimg.com/widgets/timelines/';

			return $http.jsonp( baseUrl + twitterUserId, {
					params			: {
						lang			: 'en'
						, callback		: 'JSON_CALLBACK'
						, rnd			: Math.random()
						, suppress_response_codes: true
				}
			} )
			.then( function( data ) {

				//$( 'body' ).append( data.data.body );
				var streamHtml = $( $.parseHTML( data.data.body ) )
					, stream = $( '<div></div>' ).append( streamHtml )
					, tweets = stream.find( '.stream li.tweet' );

				var posts = [];

				tweets.each( function() {
					posts.push( parseTweet( $( this ) ) );
				} );

				return posts;

			}, function( err ) {
				console.error( 'TwitterStreamService: Could not get data: %o', err );
				return $q.reject( err );
			} );

		}
	}

} ] )




.service( 'InstagramStreamService', [ '$http', '$q', function( $http, $q ) {


	function parsePost( originalPost ) {

		var post			= new Post();

		post.publishDate	= new Date( originalPost.created_time * 1000 );
		post.originalLink	= originalPost.link;
		post.source			= 'instagram';

		if( originalPost.images && originalPost.images.standard_resolution ) {
			post.image		= originalPost.images.standard_resolution.url
		}

		if( originalPost.caption ) {
			post.title		= originalPost.caption.text;
		}
		
		post.actions.push( parseLikes( originalPost ) );
		post.actions.push( parseComments( originalPost ) );

		post.author			= parseAuthor( originalPost );

		return post;

	}

	function parseLikes( originalPost ) {
		var action			= new PostAction();
		action.name			= 'like';
		action.count		= originalPost.likes.count;
		
		return action;
	}

	function parseComments( originalPost ) {
		var action			= new PostAction();
		action.name			= 'comment';
		action.count		= originalPost.comments.count;
		return action;
	}

	function parseAuthor( originalPost ) {

		var author = new PostAuthor();

		author.name			= originalPost.user.full_name;
		author.nickName		= originalPost.user.username;
		author.link			= 'http://instagram.com/' + author.nickName;
		author.image		= originalPost.user.profile_picture;

		return author;
	}


	return {

		getPosts: function( token, userId ) {

			//https://api.instagram.com/v1/users/self/feed
			return $http.jsonp( 'https://api.instagram.com/v1/users/' + userId + '/media/recent', {
				params : {
					access_token	: token
					, callback		: 'JSON_CALLBACK'
				}
			} )
			.then( function( response ) {

				if( !response || !response.data || !response.data.data || !response.data.data.length ) {
					console.error( 'InstagramStreamService: Response missing data field: %o', response );
					return $q.reject( 'Invalid Response' );
				}


				var posts = [];

				for( var i = 0; i < response.data.data.length; i++ ) {
					var post = parsePost( response.data.data[ i ] );
					posts.push( post );
				}

				return posts;

			}, function( err ) {
				console.error( 'InstagramStreamService: Could not get data: %o', err );
				return $q.reject( err );
			} );



		}

	}


} ] );

















function Post() {

	Object.defineProperty( this, 'publishDate', {
		writable: true
	} );

	// 'facebook', 'twitter' etc.
	Object.defineProperty( this, 'source', {
		writable: true
	} );

	Object.defineProperty( this, 'image', {
		writable: true
	} );

	// 'image', 'video', 'text' etc.
	Object.defineProperty( this, 'type', {
		writable: true
	} );

	// Contains a PostSource
	Object.defineProperty( this, 'source', {
		writable: true
	} );

	// Array o PostAction
	Object.defineProperty( this, 'actions', {
		writable		: true
		, value			: []
		, enumerable	: true
	} );

	Object.defineProperty( this, 'title', {
		writable: true
	} );

	Object.defineProperty( this, 'text', {
		writable: true
	} );

	Object.defineProperty( this, 'author', {
		writable: true
	} );

	// External link (external website that e.g. a facebook post points to)
	Object.defineProperty( this, 'link', {
		writable: true
	} );

	// Link to the post itself
	Object.defineProperty( this, 'originalLink', {
		writable: true
	} );


};


function PostAction() {

	Object.defineProperty( this, 'link', {
		writable		: true
		, enumerable	:true
	} );

	Object.defineProperty( this, 'count', {
		writable		: true
		, enumerable	:true
	} );

	Object.defineProperty( this, 'name', {
		writable		: true
		, enumerable	:true
	} );

}


function PostAuthor() {
	Object.defineProperty( this, 'name', {
		writable: true
	} );

	Object.defineProperty( this, 'link', {
		writable: true
	} );

	Object.defineProperty( this, 'image', {
		writable: true
	} );

	Object.defineProperty( this, 'nickName', {
		writable: true
	} );	

}

