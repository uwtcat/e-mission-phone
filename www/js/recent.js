angular.module('emission.main.recent', ['ngCordova'])

.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider
    // The root (root/main/recent) is configured in the main module
  .state('root.main.recent.log', {
    url: "/log", // /root/main/recent/log
    views: {
      'menuContent': {
        templateUrl: "templates/recent/log.html",
        controller: 'logCtrl'
      }
    }
  })

  .state('root.main.recent.sensedData', {
    url: "/sensedData",
    views: {
      'menuContent': {
        templateUrl: "templates/recent/sensedData.html",
        controller: 'sensedDataCtrl'
      }
    }
  })
    .state('root.main.recent.map', {
      url: "/map",
      views: {
        'menuContent': {
          templateUrl: "templates/recent/map.html",
          // controller: 'mapCtrl'
        }
      }
    });
})

.controller('appCtrl', function($scope, $ionicModal, $timeout) {
    $scope.openNativeSettings = function() {
        window.Logger.log(window.Logger.LEVEL_DEBUG, "about to open native settings");
        window.cordova.plugins.BEMLaunchNative.launch("NativeSettings", function(result) {
            window.Logger.log(window.Logger.LEVEL_DEBUG,
                "Successfully opened screen NativeSettings, result is "+result);
        }, function(err) {
            window.Logger.log(window.Logger.LEVEL_ERROR,
                "Unable to open screen NativeSettings because of err "+err);
        });
    }
})
     
.controller('logCtrl', function($scope, $cordovaFile, $cordovaEmailComposer, $ionicPopup) {
    console.log("Launching logCtr");
    var RETRIEVE_COUNT = 100;
    $scope.logCtrl = {};

    $scope.refreshEntries = function() {
        window.Logger.getMaxIndex(function(maxIndex) {
            console.log("maxIndex = "+maxIndex);
            $scope.logCtrl.currentStart = maxIndex;
            $scope.logCtrl.gotMaxIndex = true;
            $scope.logCtrl.reachedEnd = false;
            $scope.entries = [];
            $scope.addEntries();
        }, function (e) {
            var errStr = "While getting max index "+JSON.stringify(e, null, 2);
            console.log(errStr);
            alert(errStr);
        });
    }

    $scope.moreDataCanBeLoaded = function() {
        return $scope.logCtrl.gotMaxIndex && !($scope.logCtrl.reachedEnd);
    }

    $scope.clear = function() {
        window.Logger.clearAll();
        window.Logger.log(window.Logger.LEVEL_INFO, "Finished clearing entries from unified log");
        $scope.refreshEntries();
    }

    $scope.addEntries = function() {
        console.log("calling addEntries");
        window.Logger.getMessagesFromIndex($scope.logCtrl.currentStart, RETRIEVE_COUNT,
            function(entryList) {
                $scope.$apply($scope.processEntries(entryList));
                console.log("entry list size = "+$scope.entries.length);
                console.log("Broadcasting infinite scroll complete");
                $scope.$broadcast('scroll.infiniteScrollComplete')
            }, function(e) {
                var errStr = "While getting messages from the log "+JSON.stringify(e, null, 2);
                console.log(errStr);
                alert(errStr);
                $scope.$broadcast('scroll.infiniteScrollComplete')
            }
        )
    }

    $scope.processEntries = function(entryList) {
        for (i = 0; i < entryList.length; i++) {
            var currEntry = entryList[i];
            $scope.entries.push(currEntry);
        }
        if (entryList.length == 0) {
            console.log("Reached the end of the scrolling");
            $scope.logCtrl.reachedEnd = true;
        } else {
            $scope.logCtrl.currentStart = entryList[entryList.length-1].ID
            console.log("new start index = "+$scope.logCtrl.currentStart);
        }
    }

    $scope.emailLog = function() {
        var parentDir = "unknown";

         $cordovaEmailComposer.isAvailable().then(function() {
           // is available
         }, function () {
            alert("Email account is not configured, cannot send email");
            return;
         });

        if (ionic.Platform.isAndroid()) {
            parentDir = "app://databases";
        } 
        if (ionic.Platform.isIOS()) {
            alert("You must have the mail app on your phone configured with an email address. Otherwise, this won't work");
            parentDir = cordova.file.documentsDirectory;
        }
        
        /*
        window.Logger.log(window.Logger.LEVEL_INFO,
            "Going to export logs to "+parentDir);
         */
        alert("Going to email database from "+parentDir+"/loggerDB");

        var email = {
            to: ['shankari@eecs.berkeley.edu'],
            attachments: [
                parentDir+"/loggerDB"
            ],
            subject: 'emission logs',
            body: 'please fill in what went wrong'
        }

        $cordovaEmailComposer.open(email).then(function() {
           window.Logger.log(window.Logger.LEVEL_DEBUG,
               "Email queued successfully");
        },
        function () {
           // user cancelled email. in this case too, we want to remove the file
           // so that the file creation earlier does not fail.
           alert("User cancelled email");
        });
    }

    $scope.removeFile = function(FILE_NAME) {
        $cordovaFile.removeFile(cordova.file.cacheDirectory, FILE_NAME)
            .then(function (fd) {
                alert("Successfully removed file"+JSON.stringify(fd, null, 2));
            }, function (error) {
                alert("Failed to remove file"+JSON.stringify(error, null, 2));
            });
    }

    $scope.exportToFile = function(fd) {
        var q = $q.defer();

        var done = false;
        var RETRIEVE_COUNT = 1000;
        window.Logger.log(window.Logger.LEVEL_DEBUG,
            "About to export to file "+ cordova.file.cacheDirectory + fd.name);
        window.Logger.getMaxIndex(function(maxIndex) {
            var currIndex = maxIndex;
            while(!done) {
                window.Logger.getMessagesFromIndex(currIndex, RETRIEVE_COUNT,
                function(entryList) {
                    $cordovaFile.writeExistingFile(cordova.file.cacheDirectory, fd.name, entryList)
                        .then(function(result) {
                            if (entryList.length == 0) {
                                console.log("Reached the end of the export");
                                done = true;
                                q.resolve();
                            } else {
                                currIndex  = entryList[entryList.length-1].ID
                                console.log("while exporting, new start index = "+currIndex);
                            }
                        }, function(reject) {
                        });
                }, function(e) {
                    var errStr = "While exporting messages to file, got error "+JSON.stringify(e, null, 2);
                    console.log(errStr);
                    alert(errStr);
                    q.reject();
                });
            }
        }, function(e) {
            var errStr = "While getting max index for exporting"+JSON.stringify(e, null, 2);
            console.log(errStr);
            alert(errStr);
            q.reject();
        });
        return q.promise;
    }

    $scope.refreshEntries();
})
   
.controller('sensedDataCtrl', function($scope) {
    var currentStart = 0;

    /* Let's keep a reference to the database for convenience */
    var db = window.cordova.plugins.BEMUserCache;

    $scope.config = {}
    $scope.config.key_data_mapping = {
        "Transitions": {
            fn: db.getMessages,
            key: "statemachine/transition"
        },
        "Locations": {
            fn: db.getSensorData,
            key: "background/location"
        },
        "Motion Activity": {
            fn: db.getSensorData,
            key: "background/motion_activity"
        },
    }

    $scope.config.keys = []
    for (key in $scope.config.key_data_mapping) {
        $scope.config.keys.push(key);
    }

    $scope.selected = {}
    $scope.selected.key = $scope.config.keys[0]

    $scope.setSelected = function() {
      $scope.updateEntries();
    } 

  $scope.updateEntries = function() {
    if (angular.isUndefined($scope.selected.key)) {
        usercacheFn = db.getMessages;
        usercacheKey = "statemachine/transition";
    } else {
        usercacheFn = $scope.config.key_data_mapping[$scope.selected.key]["fn"]
        usercacheKey = $scope.config.key_data_mapping[$scope.selected.key]["key"]
    }
    usercacheFn(usercacheKey, function(entryList) {
      $scope.entries = [];
      $scope.$apply(function() {
          for (i = 0; i < entryList.length; i++) {
            // $scope.entries.push({metadata: {write_ts: 1, write_fmt_time: "1"}, data: "1"})
            var currEntry = entryList[i];
            currEntry.data = JSON.stringify(JSON.parse(currEntry.data), null, 2);
            window.Logger.log(window.Logger.LEVEL_DEBUG,
                "currEntry.data = "+currEntry.data);
            $scope.entries.push(currEntry);
            // This should really be within a try/catch/finally block
            $scope.$broadcast('scroll.refreshComplete');
          }
      })
    }, function(error) {
        $ionicPopup.alert({template: JSON.stringify(error)})
            .then(function(res) {console.log("finished showing alert");});
    })
  }

  $scope.updateEntries();
})
   
.controller('mapCtrl', function($scope) {

});
 


