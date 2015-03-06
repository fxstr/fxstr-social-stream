<?php

// For CURL usage, see http://stackoverflow.com/questions/15203310/how-to-use-curl-in-facebook-graph-api-request

// GET parameters that can be passed: 
// - entity (e.g. /123123/likes) 
// - facebookPage (id or name)


$access_token = 'yourAccessToken';



if( !isset( $_GET[ "facebookPage" ] ) ) {
  echo "{\"error\": \"facebookPage missing\"}";
  return;
}

$facebookPage = $_GET[ "facebookPage" ];


// Entity to get
$entity =  $facebookPage . '/feed';

if( isset( $_GET[ "entity" ] ) ) {
  // The only allowed call is to /objectId/likes to get amount of likes
  $regex = "/[0-9]*\/likes/";
  if( preg_match( $regex, $_GET[ "entity" ] ) ) {
    $entity = $_GET[ "entity" ];
    $params = "summary=true&count=1";
  }
}


$ch = curl_init();

if(!$ch) {
  echo "{error:\"Curl not available\"}";
  return;
}

$url = 'https://graph.facebook.com/v2.2/' . $entity . '?access_token='.$access_token;
if( isset( $params ) ) {
  $url .= '&' . $params;
}


curl_setopt($ch, CURLOPT_HEADER, 0);
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);

curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_VERBOSE, true);

$result = curl_exec($ch);

if( !$result ) {
  $err = curl_error ( $ch );
  echo "{ \"error\": \"" . $err . "\"}";
  return;
}

curl_close($ch);
echo $result;


?>