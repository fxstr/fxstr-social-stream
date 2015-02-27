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
			// To generate id, see here: https://cdn.syndication.twimg.com/widgets/timelines/69093174?lang=en&callback=twitterFetcher.callback&suppress_response_codes=true&rnd=123123
			, socialStreamTwitterId			: '='
			, socialStreamInstagramToken	: '='
		}
		, templateUrl	: 'socialStreamTemplate'
	};

} ] )


.controller( 'SocialStreamDirectiveController', [ '$scope', '$q', 'FacebookStreamService', 'TwitterStreamService', 'InstagramStreamService', function( $scope, $q, FacebookStreamService, TwitterStreamService, InstagramStreamService ) {

	var self		= this
		, element;

	$scope.posts = [];

	self.init = function( el ) {
		element = el;
	}

	// #todo: remove old posts when getting new ones
	$scope.$watch( 'socialStreamFacebookPage', function( newValue ) {
		
		FacebookStreamService.getPosts( newValue )
			.then( function( fbPosts ) {
				$scope.posts = $scope.posts.concat( fbPosts );
			} );

	} );


	$scope.$watch( 'socialStreamTwitterId', function( newValue ) {
		
		TwitterStreamService.getPosts( newValue )
			.then( function( twrPosts ) {
				$scope.posts = $scope.posts.concat( twrPosts );
			} );

	} );


	$scope.$watch( 'socialStreamInstagramToken', function( newValue ) {

		InstagramStreamService.getPosts( newValue )
			.then( function( igrPosts ) {
				$scope.posts = $scope.posts.concat( igrPosts );
			} );

	} );

} ] )

.factory( 'FacebookStreamService', [ '$http', '$q', function( $http, $q ) {

	var typeIdentifier		= 'facebook'
		, baseUrl			= 'https://graph.facebook.com/v2.2/';


	function parsePost( originalPost ) {

		//console.log( 'parse %o', originalPost );

		var post = new Post();
		parsePostBase( originalPost, post );
	
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
			console.error( originalPost.type );
		}

		return post;

	}

	/**
	* Parses post's standard information
	*/
	function parsePostBase( originalPost, post ) {

		post.publishDate	= new Date( originalPost.created_time );
		post.link			= originalPost.link;
		post.originalLink	= 'http://facebook.com/' + originalPost.id;
		post.source			= typeIdentifier;
		post.type			= originalPost.type;

		// author
		var author			= new PostAuthor();
		author.name			= originalPost.from.name;
		author.link			= 'http://facebook.com/' + originalPost.from.id;
		post.author			= author;

		// Use promise to update post.actions, as only this solution will
		// propagate to the frontend
		parseLikes( originalPost, post ).then( function( likeObj ) {
			post.actions.push( likeObj );
		} );
		parseComments( originalPost, post );

	}


	function parseLikes( originalPost, post ) {

		var deferred = $q.defer();

		FB.api( originalPost.id + '/likes?limit=1000', function( response ) {
			
			if( !response.data ) {
				console.error( 'FacebookStreamService: Could not get likes: %o', response );
				return deferred.reject( response );
			}	

			var likeCount = response.data.length;

			var likeObj			= new PostAction();
			likeObj.count		= likeCount;
			likeObj.name		= 'like';

			return deferred.resolve( likeObj );

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


	/**
	* Returns actions in form of an object: {
	*	like		: likeLink
	*	, comment	: commentLink
	* }
	*/
	/*function parseActions( actions ) {

		var ret = {
			like		: undefined
			, comment	: undefined
		};

		if( !actions || !actions.length ) {
			return ret;
		}

		// Link is in originalPost.actions
		for( var i = 0; i < actions.length; i++ ) {
			if( actions[ i ].name === 'Like' ) {
				ret.like = actions[ i ].link;
			}
			else if( actions[ i ].name === 'Comment' ) {
				ret.comment = actions[ i ].link;
			}
		}

		return ret;

	}*/

	function parseLink( originalPost, post ) {

		post.title		= parseMessage( originalPost.message, originalPost.message_tags );
		post.text		= originalPost.description;

	}



	function parseVideo( originalPost, post ) {
		post.image		= originalPost.picture;
		post.title		= parseMessage( originalPost.message, originalPost.message_tags );
	}


	function parsePhoto( originalPost, post ) {

		post.title		= parseMessage( originalPost.message, originalPost.message_tags );
		post.image		= originalPost.picture;

	}


	function parseMessage( message, tagObject ) {

		//console.log( 'parse message %o %o', message, tagObject );

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

		//console.log( 'result: %o', message );
		return message;

	}


	return {

		getPosts: function( page ) {

			console.log( 'FacebookStreamService: Get Facebook Posts for %o', page );

			var deferred = $q.defer();
			var posts = [];

			FB.api( '/missswitzerland/feed', function( response ) {
				
				if( !response.data || !response.data.length ) {
					console.error( 'FacebookStreamService: Empty response %o', response.data );
					deferred.reject( response );
					return;
				}

				var posts = [];

				for( var i = 0; i < response.data.length; i++ ) {
					var post = response.data[ i ];
					posts.push( parsePost( post ) );
				}

				deferred.resolve( posts );

			} );

			return deferred.promise;

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
		post.publishDate	= new Date( originalTweet.find( '.header time' ).attr( 'datetime' ) );

		// Retweets

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




.service( 'InstagramStreamService', [ '$http', function( $http ) {


	function parsePost( originalPost ) {

		var post			= new Post();

		post.publishDate	= new Date( originalPost.created_time * 1000 );
		post.originalLink	= originalPost.link;

		if( originalPost.images && originalPost.images.standard_resolution ) {
			post.image		= originalPost.images.standard_resolution.url
		}

		if( originalPost.caption ) {
			post.title			= originalPost.caption.text;
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

		getPosts: function( token ) {

			//https://api.instagram.com/v1/users/self/feed
			return $http.jsonp( 'https://api.instagram.com/v1/users/self/feed', {
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
					console.log( response.data.data[ i ] );
					var post = parsePost( response.data.data[ i ] );
					console.log( 'parsed: %o', post );
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

	// External link
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

