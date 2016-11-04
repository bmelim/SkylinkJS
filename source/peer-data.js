/**
 * Stores the list of Peers session information.
 * @attribute _peerInformations
 * @param {JSON} <#peerId> The Peer session information.
 * @param {JSON|String} <#peerId>.userData The Peer custom data.
 * @param {JSON} <#peerId>.settings The Peer streaming information.
 * @param {JSON} <#peerId>.mediaStatus The Peer streaming muted status.
 * @param {JSON} <#peerId>.agent The Peer agent information.
 * @type JSON
 * @private
 * @for Skylink
 * @since 0.3.0
 */
Skylink.prototype._peerInformations = {};

/**
 * Stores the Signaling user credentials from the API response required for connecting to the Signaling server.
 * @attribute _user
 * @param {String} uid The API result "username".
 * @param {String} token The API result "userCred".
 * @param {String} timeStamp The API result "timeStamp".
 * @param {String} sid The Signaling server receive user Peer ID.
 * @type JSON
 * @private
 * @for Skylink
 * @since 0.5.6
 */
Skylink.prototype._user = null;

/**
 * Stores the User custom data.
 * By default, if no custom user data is set, it is an empty string <code>""</code>.
 * @attribute _userData
 * @type JSON|String
 * @default ""
 * @private
 * @for Skylink
 * @since 0.5.6
 */
Skylink.prototype._userData = '';

/**
 * Function that overwrites the User current custom data.
 * @method setUserData
 * @param {JSON|String} userData The updated custom data.
 * @trigger <ol class="desc-seq">
 *   <li>Updates User custom data. <ol>
 *   <li>If User is in Room: <ol>
 *   <li><a href="#event_peerUpdated"><code>peerUpdated</code> event</a> triggers with parameter payload
 *   <code>isSelf</code> value as <code>true</code>.</li></ol></li></ol></li></ol>
 * @example
 *   // Example 1: Set/Update User custom data before joinRoom()
 *   var userData = "beforejoin";
 *
 *   skylinkDemo.setUserData(userData);
 *
 *   skylinkDemo.joinRoom(function (error, success) {
 *      if (error) return;
 *      if (success.peerInfo.userData === userData) {
 *        console.log("User data is sent");
 *      }
 *   });
 *
 *   // Example 2: Update User custom data after joinRoom()
 *   var userData = "afterjoin";
 *
 *   skylinkDemo.joinRoom(function (error, success) {
 *     if (error) return;
 *     skylinkDemo.setUserData(userData);
 *     if (skylinkDemo.getPeerInfo().userData === userData) {
 *       console.log("User data is updated and sent");
 *     }
 *   });
 * @for Skylink
 * @since 0.5.5
 */
Skylink.prototype.setUserData = function(userData) {
  var self = this;

  this._userData = userData || '';

  if (self._inRoom) {
    log.log('Updated userData -> ', userData);
    self._sendChannelMessage({
      type: self._SIG_MESSAGE_TYPE.UPDATE_USER,
      mid: self._user.sid,
      rid: self._room.id,
      userData: self._userData,
      stamp: (new Date()).getTime()
    });
    self._trigger('peerUpdated', self._user.sid, self.getPeerInfo(), true);
  } else {
    log.warn('User is not in the room. Broadcast of updated information will be dropped');
  }
};

/**
 * Function that returns the User / Peer current custom data.
 * @method getUserData
 * @param {String} [peerId] The Peer ID to return the current custom data from.
 * - When not provided or that the Peer ID is does not exists, it will return
 *   the User current custom data.
 * @return {JSON|String} The User / Peer current custom data.
 * @example
 *   // Example 1: Get Peer current custom data
 *   var peerUserData = skylinkDemo.getUserData(peerId);
 *
 *   // Example 2: Get User current custom data
 *   var userUserData = skylinkDemo.getUserData();
 * @for Skylink
 * @since 0.5.10
 */
Skylink.prototype.getUserData = function(peerId) {
  if (peerId && peerId !== this._user.sid) {
    // peer info
    var peerInfo = this._peerInformations[peerId];

    if (typeof peerInfo === 'object') {
      return peerInfo.userData;
    }

    return null;
  }
  return this._userData;
};

/**
 * Function that returns the User / Peer current session information.
 * @method getPeerInfo
 * @param {String} [peerId] The Peer ID to return the current session information from.
 * - When not provided or that the Peer ID is does not exists, it will return
 *   the User current session information.
 * @return {JSON} The User / Peer current session information.
 *   <small>Object signature matches the <code>peerInfo</code> parameter payload received in the
 *   <a href="#event_peerJoined"><code>peerJoined</code> event</a>.</small>
 * @example
 *   // Example 1: Get Peer current session information
 *   var peerPeerInfo = skylinkDemo.getPeerInfo(peerId);
 *
 *   // Example 2: Get User current session information
 *   var userPeerInfo = skylinkDemo.getPeerInfo();
 * @for Skylink
 * @since 0.4.0
 */
Skylink.prototype.getPeerInfo = function(peerId) {
  var peerInfo = null;

  if (typeof peerId === 'string' && typeof this._peerInformations[peerId] === 'object') {
    peerInfo = clone(this._peerInformations[peerId]);
    peerInfo.room = clone(this._selectedRoom);
    peerInfo.settings.googleXBandwidth = {};

    if (peerInfo.settings.video && typeof peerInfo.settings.video === 'object' &&
      peerInfo.settings.video.frameRate === -1) {
      peerInfo.settings.video.frameRate = null;
    }

    if (peerInfo.settings.audio && typeof peerInfo.settings.audio === 'object') {
      peerInfo.settings.audio.usedtx = null;
      peerInfo.settings.audio.maxplaybackrate = null;
      peerInfo.settings.audio.useinbandfec = null;
    }

    if (peerId === 'MCU') {
      // MCU will not send any stream
      peerInfo.settings.audio = false;
      peerInfo.settings.video = false;
      peerInfo.settings.mediaStatus = {
        audioMuted: true,
        videoMuted: true
      };
    }

  } else {
    peerInfo = {
      userData: clone(this._userData) || '',
      settings: {
        audio: false,
        video: false
      },
      mediaStatus: clone(this._streamsMutedSettings),
      agent: {
        name: window.webrtcDetectedBrowser,
        version: window.webrtcDetectedVersion,
        os: window.navigator.platform,
        pluginVersion: AdapterJS.WebRTCPlugin.plugin ? AdapterJS.WebRTCPlugin.plugin.VERSION : null
      },
      room: clone(this._selectedRoom),
      config: {
        enableDataChannel: this._enableDataChannel,
        enableIceTrickle: this._enableIceTrickle,
        enableIceRestart: this._enableIceRestart,
        priorityWeight: this._peerPriorityWeight
      }
    };

    if (this._streams.screenshare) {
      peerInfo.settings = clone(this._streams.screenshare.settings);
    } else if (this._streams.userMedia) {
      peerInfo.settings = clone(this._streams.userMedia.settings);
    }

    peerInfo.settings.bandwidth = clone(this._streamsBandwidthSettings.bAS);
    peerInfo.settings.googleXBandwidth = clone(this._streamsBandwidthSettings.googleX);
  }

  if (!peerInfo.settings.audio) {
    peerInfo.mediaStatus.audioMuted = true;
  }

  if (!peerInfo.settings.video) {
    peerInfo.mediaStatus.videoMuted = true;
  }

  return peerInfo;
};

/**
 * Function that gets the list of connected Peers in the Room.
 * @method getPeersInRoom
 * @return {JSON} The list of the connected Peers.
 *   <small>Each property is the Peer ID with its value as the Peer current session information, which
 *   object signature matches the <code>peerInfo</code> parameter payload received in the
 *   <a href="#event_peerJoined"><code>peerJoined</code> event</a>.</small>
 * @example
 *   // Example 1: Get the list of currently connected Peers in the same Room
 *   var peers = skylinkDemo.getPeersInRoom();
 * @for Skylink
 * @since 0.6.16
 */
Skylink.prototype.getPeersInRoom = function() {
  var listOfPeersInfo = {};
  var listOfPeers = Object.keys(this._peerInformations);

  for (var i = 0; i < listOfPeers.length; i++) {
    listOfPeersInfo[listOfPeers[i]] = this.getPeerInfo(listOfPeers[i]);
  }

  return listOfPeersInfo;
};

/**
 * Function that returns the User session information to be sent to Peers.
 * @method _getUserInfo
 * @private
 * @for Skylink
 * @since 0.4.0
 */
Skylink.prototype._getUserInfo = function(peerId) {
  var userInfo = clone(this.getPeerInfo());

  // Adhere to SM protocol without breaking the other SDKs.
  if (userInfo.settings.video && typeof userInfo.settings.video === 'object' &&
    typeof userInfo.settings.video.frameRate !== 'number') {
    userInfo.settings.video.frameRate = -1;
  }

  // Adhere to SM protocol. Stop adding new things to the current protocol until things are finalised.
  if (userInfo.settings.audio && typeof userInfo.settings.audio === 'object') {
    delete userInfo.settings.audio.usedtx;
    delete userInfo.settings.audio.maxplaybackrate;
    delete userInfo.settings.audio.useinbandfec;
  }

  delete userInfo.agent;
  delete userInfo.room;
  delete userInfo.settings.googleXBandwidth;

  return userInfo;
};

/**
 * Function that parses the Peer session information.
 * @method _parseUserInfo
 * @private
 * @for Skylink
 * @since 0.6.16
 */
Skylink.prototype._parseUserInfo = function(message) {
  var userInfo = {
    agent: {
      name: typeof message.agent === 'string' && message.agent ? message.agent : 'other',
      version: typeof message.version === 'number' && message.version ? message.version : 0,
      os: typeof message.os === 'string' && message.os ? message.os : '',
      pluginVersion: typeof message.temasysPluginVersion === 'string' && message.temasysPluginVersion ?
        message.temasysPluginVersion : null
    },
    settings: {
      audio: false,
      video: false,
      bandwidth: {}
    },
    mediaStatus: {
      audioMuted: true,
      videoMuted: true
    },
    config: {
      enableIceTrickle: typeof message.enableIceTrickle === 'boolean' ? message.enableIceTrickle : true,
      enableIceRestart: typeof message.enableIceRestart === 'boolean' ? message.enableIceRestart : false,
      enableDataChannel: typeof message.enableDataChannel === 'boolean' ? message.enableDataChannel : true,
      priorityWeight: typeof message.weight === 'number' ? message.weight : 0
    },
    userData: message.userData || ''
  };

  if (typeof message.userInfo === 'object' && message.userInfo) {
    if (typeof message.userInfo.settings === 'object' &&message.userInfo.settings) {
      userInfo.settings = message.userInfo.settings;

      if (!(typeof message.userInfo.settings.bandwidth === 'object' && userInfo.settings.bandwidth)) {
        userInfo.settings.bandwidth = {};
      }
    }

    if (typeof message.userInfo.mediaStatus === 'object' && message.userInfo.mediaStatus) {
      userInfo.mediaStatus = message.userInfo.mediaStatus;

      if (typeof userInfo.mediaStatus.audioMuted === 'boolean') {
        userInfo.mediaStatus.audioMuted = false;
      }

      if (typeof userInfo.mediaStatus.videoMuted === 'boolean') {
        userInfo.mediaStatus.videoMuted = false;
      }
    }
  }

  return userInfo;
};