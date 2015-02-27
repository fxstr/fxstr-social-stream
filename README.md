#Description

A simple angular directive that gets the latest entries from Twitter, Facebook, Instagram. Can/must be templated by yourself.

#Installation

Download manually or through bower:

```bash
$ bower install fxstr-social-stream
```

Plugin requires angular.

# Usage

1. Use [$sce](https://docs.angularjs.org/api/ng/service/$sce) to display the HTML returned in the fields ```title``` and ```text``` in your template.

1. Include ```fxstr-social-stream.js``` in your scripts:

  ```html
  <script src="bower_components/fxstr-social-stream/src/fxstr-social-stream.js"></script>
  ```

1. Load ```fxstr.socialStream``` in your angular module definition:

  ```javascript
  angular.module( 'myModule', [ 'fxstr.socialStream' ] );
  ```
  
1. If you'd like to use Facebook: 

  1. Create a new Facebook app and get it's ID or use the ID of an existing one. 
  2. Include the Facebook JS SDK on your site (for async loading, consult [the Facebook JS SDK documentation](https://developers.facebook.com/docs/javascript/quickstart/v2.2):
   
    ```html
        <script src="https://connect.facebook.net/en_US/all.js"></script>
        <script>
	      window.fbAsyncInit = function() {
	      FB.init( {
	        appId        : 'your-app-id'
	        , xfbml      : true
	        , version    : 'v2.1'
	      } );
	    };
	```

1. If you'd like to use Twitter:

  1. Visit **Settings**, then **Widgets** ([direct link](https://twitter.com/settings/widgets)). Create a new widget.
  1. Note your widget's ID (take it from the URL: https://twitter.com/settings/widgets/[YOUR_WIDGET_ID]/edit)

1. If you'd like to use Instagram: 

  1. Generate an access token with read_stream privileges (your own stream will be displayed).
  1. Visit the [instagram API console](https://instagram.com/developer/api-console/)
  1. Chose OAuth as the authentication method. 
  1. You will be redirected to https://instagram.com/oauth/authorize…
  1. From this URL, remove the scope params ( i.e. ```?scope=likes+relationships&``` )
  1. Connect. Then in the API console, make a simple call (e.g. to /users/self/feed). 
  1. Your API token will be visible in the URL that's being called.


1. Add the social Stream to your DOM: 
  ```html
  <div data-social-stream
    data-social-stream-facebook-page="'myPage'"
    data-social-stream-instagram-token="'myToken'"
    data-social-stream-twitter-id="'myWidgetId'">
  </div>
  ``

1. Create the template (id must be ```socialStreamTemplate```)

  ```html
    <script type="text/ng-template" id="socialStreamTemplate">
    	<ul>
	    	<li data-ng-repeat="post in posts | orderBy : 'publishDate' : true">
	    		<span>{{post.publishDate}}</span>
	    		<img data-ng-attr-src="{{post.image}}" />
	    		<p>{{ post.title }}</p>
	    		<small> {{ post.text }} </small>
	    		<div><span data-ng-repeat="action in post.actions"> | {{ action.count }} {{ action.name }} |</span></div>
	    		<a data-ng-attr-href="{{post.originalLink}}">{{ post.source }}</a> von <a data-ng-attr-href="{{post.author.link}}">{{post.author.name }}</a>
	    		<a data-ng-attr-href="{{post.link}}">link</a>
	    	</li>
    	</ul>
    </script>

  ```