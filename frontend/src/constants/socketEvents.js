/**
 * SOCKET EVENT CONTRACT (Client)
 *
 * Centralized registry of all Socket.io event names exchanged between
 * the client and backend.
 *
 * Client Emits:
 *   USER_CONNECTED     -> Notifies server user is active
 *   SEND_MESSAGE       -> Sends a message to a conversation
 *   MESSAGE_READ       -> Marks messages as read (seen)
 *   TYPING_START       -> Broadcasts typing state to recipient
 *   TYPING_STOP        -> Clears typing state
 *   ADD_REACTION       -> Adds or toggles an emoji reaction
 *   CALL_USER          -> Initiates audio/video call with SDP offer
 *   ACCEPT_CALL        -> Accepts call with SDP answer
 *   REJECT_CALL        -> Declines incoming call
 *   CANCEL_CALL        -> Caller aborts call before answer
 *   END_CALL           -> Terminates active call
 *   ICE_CANDIDATE      -> Exchanged STUN/TURN network candidate
 *   MEDIA_STATE_CHANGE -> Mute/unmute microphone or camera
 *
 * Server Broadcasts:
 *   USER_STATUS        -> Online/offline presence changes
 *   RECEIVE_MESSAGE    -> Delivers message to online recipient
 *   MESSAGE_STATUS     -> Updates status (delivered, read)
 *   USER_TYPING        -> Displays or hides typing indicator
 *   INCOMING_CALL      -> Rings recipient with caller details & SDP offer
 *   CALL_ACCEPTED      -> Delivers SDP answer to caller
 *   CALL_REJECTED      -> Notifies caller the call was declined
 *   CALL_ENDED         -> Cleans up media streams & call UI
 *   NEW_NOTIFICATION   -> Toast/badge push notification
 */

export const SOCKET_EVENTS = Object.freeze({
  // Presence & Connection
  USER_CONNECTED: "user_connected",
  GET_USER_STATUS: "get_user_status",
  USER_STATUS: "user_status",
  CONTACT_STATUS_CHANGE: "contact_status_change",
  SET_STATUS: "set_status",

  // Messaging & Receipts
  SEND_MESSAGE: "send_message",
  RECEIVE_MESSAGE: "receive_message",
  MESSAGE_READ: "message_read",
  MESSAGE_STATUS_UPDATE: "message_status_update",
  MESSAGE_ERROR: "message_error",

  // Typing Indicators
  TYPING_START: "typing_start",
  TYPING_STOP: "typing_stop",
  USER_TYPING: "user_typing",

  // Reactions
  ADD_REACTION: "add_reaction",
  REACTION_UPDATE: "reaction_update",

  // WebRTC Signaling & Calls
  CALL_USER: "call_user",
  INCOMING_CALL: "incoming_call",
  ACCEPT_CALL: "accept_call",
  CALL_ACCEPTED: "call_accepted",
  REJECT_CALL: "reject_call",
  CALL_REJECTED: "call_rejected",
  CANCEL_CALL: "cancel_call",
  CALL_CANCELLED: "call_cancelled",
  END_CALL: "end_call",
  CALL_ENDED: "call_ended",
  CALL_USER_OFFLINE: "call_user_offline",
  CALL_USER_BUSY: "call_user_busy",
  ICE_CANDIDATE: "ice_candidate",
  MEDIA_STATE_CHANGED: "media_state_changed",

  // Notifications
  NEW_NOTIFICATION: "new_notification",
});

export default SOCKET_EVENTS;
