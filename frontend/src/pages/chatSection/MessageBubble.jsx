import React, { useState, useRef, useEffect } from "react";
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Smile,
  Reply,
  MoreHorizontal,
  Forward,
  Pencil,
} from "lucide-react";

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🙏", "👍"];

const MessageBubble = ({
  msg,
  dark,
  onRetry,
  onReplyPreviewClick,
  onReply,
  onForward,
  onReact,
  currentUserId,
}) => {
  const ink = dark ? "#E9EDEF" : "#111B21";
  const sub = dark ? "#8696A0" : "#667781";
  const accent = "#25D366";
  const bubbleMine = dark ? "#005C4B" : "#D9FDD3";
  const bubbleTheirs = dark ? "#1F2C34" : "#FFFFFF";
  const danger = "#E74C3C";
  const panelBg = dark ? "#233138" : "#FFFFFF";
  const panelBorder = dark ? "#3A4750" : "#E9EDEF";

  const [hovered, setHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  const [decryptedContent, setDecryptedContent] = useState(msg.message || msg.content || "");

  useEffect(() => {
    let active = true;
    const performDecryption = async () => {
      const rawText = msg.message || msg.content || "";
      if (rawText) {
        try {
          const { decryptText } = await import("../../utils/crypto");
          const senderId = msg.sender?._id || msg.sender;
          const convId = msg.conversationId || msg.conversation?._id || msg.conversation;
          const decrypted = await decryptText(rawText, convId, senderId, currentUserId);
          if (active) {
            setDecryptedContent(decrypted);
          }
        } catch (e) {
          if (active) {
            setDecryptedContent(rawText);
          }
        }
      } else {
        if (active) {
          setDecryptedContent("");
        }
      }
    };
    performDecryption();
    return () => {
      active = false;
    };
  }, [msg.message, msg.content, msg.conversationId, msg.conversation, msg.sender, currentUserId]);

  const isMine = !!msg.isMine;
  const isFailed = msg.status === "failed";
  const isSending = msg.status === "sending";
  const reactions = msg.reactions || []; // [{ emoji, userId, userName }]

  useEffect(() => {
    if (!pickerOpen) return;
    const onDocClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [pickerOpen]);

  const formatTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleClick = () => {
    if (isFailed && onRetry) onRetry(msg);
  };

  const handlePickReaction = (emoji) => {
    setPickerOpen(false);
    if (onReact) onReact(msg, emoji);
  };

  // Group reactions by emoji -> count + whether current user reacted
  const groupedReactions = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, count: 0, mine: false, names: [] };
    acc[r.emoji].count += 1;
    acc[r.emoji].names.push(r.userName || "Someone");
    if (r.userId === currentUserId) acc[r.emoji].mine = true;
    return acc;
  }, {});
  const reactionList = Object.values(groupedReactions);

  const isImage = msg.mediaUrl && msg.messageType === "image";
  const isVideo = msg.mediaUrl && msg.messageType === "video";
  const isDocument = msg.mediaUrl && msg.messageType === "document";

  const documentLinkStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13.5,
    color: ink,
    textDecoration: "none",
    marginBottom: msg.message ? 6 : 2,
    wordBreak: "break-all",
    padding: "8px 10px",
    borderRadius: 8,
    background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.035)",
  };

  return (
    <div
      className="mb-bubble-in mb-row"
      style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", padding: "1px 4px" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPickerOpen(false);
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexDirection: isMine ? "row-reverse" : "row",
          maxWidth: "78%",
        }}
      >
        {/* Bubble */}
        <div style={{ position: "relative" }}>
          {/* WhatsApp-style tail */}
          <svg
            width="9"
            height="13"
            viewBox="0 0 9 13"
            style={{
              position: "absolute",
              top: 0,
              [isMine ? "right" : "left"]: -8,
              transform: isMine ? "scaleX(-1)" : "none",
              filter: dark
                ? "none"
                : "drop-shadow(1px 1px 1px rgba(0,0,0,0.05))",
            }}
          >
            <path
              d="M0 0 C0 6 4 10 9 13 L0 13 Z"
              fill={isMine ? bubbleMine : bubbleTheirs}
            />
          </svg>

          <div
            onClick={handleClick}
            style={{
              maxWidth: 360,
              padding: "6px 9px 8px",
              borderRadius: 8,
              background: isMine ? bubbleMine : bubbleTheirs,
              color: ink,
              boxShadow: dark
                ? "0 1px 2px rgba(0,0,0,0.45)"
                : "0 1px 2px rgba(0,0,0,0.1)",
              opacity: isSending ? 0.7 : 1,
              cursor: isFailed ? "pointer" : "default",
              marginBottom: reactionList.length ? 12 : 0,
              position: "relative",
            }}
          >
            {msg.forwarded ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11.5,
                  fontStyle: "italic",
                  color: sub,
                  marginBottom: 4,
                }}
              >
                <Forward size={11} />
                Forwarded
              </div>
            ) : null}

            {msg.replyTo && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (onReplyPreviewClick) onReplyPreviewClick(msg.replyTo);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  padding: "5px 8px",
                  marginBottom: 5,
                  borderLeft: "3px solid " + accent,
                  borderRadius: 6,
                  background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                  cursor: onReplyPreviewClick ? "pointer" : "default",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: accent }}>
                  {msg.replyTo.isMine ? "You" : msg.replyTo.senderName || "Contact"}
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    color: sub,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {msg.replyTo.message || "Media message"}
                </span>
              </div>
            )}

            {msg.isDeleted ? (
              <p
                style={{
                  fontSize: 13.5,
                  fontStyle: "italic",
                  color: sub,
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                🚫 This message was deleted
              </p>
            ) : (
              <React.Fragment>
                {isImage ? (
                  <img
                    src={msg.mediaUrl}
                    alt="attachment"
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: "100%",
                      maxWidth: 260,
                      borderRadius: 6,
                      marginBottom: msg.message ? 6 : 2,
                      display: "block",
                      objectFit: "cover",
                    }}
                  />
                ) : null}

                {isVideo ? (
                  <video
                    src={msg.mediaUrl}
                    controls
                    style={{
                      width: "100%",
                      maxWidth: 260,
                      borderRadius: 6,
                      marginBottom: msg.message ? 6 : 2,
                      display: "block",
                    }}
                  />
                ) : null}

                {isDocument ? (
                  <DocumentLink url={msg.mediaUrl} linkStyle={documentLinkStyle} />
                ) : null}

                {decryptedContent ? (
                  <p
                    style={{
                      fontSize: 14.5,
                      lineHeight: 1.4,
                      margin: 0,
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                      paddingRight: 46, // reserve room so time/tick doesn't overlap last line awkwardly (WA style)
                    }}
                  >
                    {decryptedContent}
                  </p>
                ) : null}
              </React.Fragment>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 4,
                marginTop: 2,
                float: "right",
                marginLeft: 6,
              }}
            >
              {isFailed ? (
                <span
                  style={{
                    fontSize: 11,
                    color: danger,
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <AlertCircle size={12} /> Tap to retry
                </span>
              ) : null}
              {msg.edited && !msg.isDeleted ? (
                <span
                  style={{
                    fontSize: 10.5,
                    color: sub,
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <Pencil size={9} /> edited
                </span>
              ) : null}
              {msg.message?.startsWith("e2ee:") && <span style={{ fontSize: 10.5, marginRight: 2 }} title="End-to-End Encrypted">🔒</span>}
              <span style={{ fontSize: 11, color: sub }}>{formatTime(msg.createdAt)}</span>
              {isMine && !msg.isDeleted ? (
                <StatusTick status={msg.status} accent={accent} sub={sub} />
              ) : null}
            </div>
            <div style={{ clear: "both" }} />
          </div>

          {/* Reaction pills, overlapping bottom edge of bubble */}
          {reactionList.length > 0 && (
            <div
              className="mb-reactions-in"
              style={{
                position: "absolute",
                bottom: -11,
                [isMine ? "right" : "left"]: 8,
                display: "flex",
                gap: 3,
              }}
            >
              {reactionList.map((r) => (
                <button
                  key={r.emoji}
                  title={r.names.join(", ")}
                  onClick={() => handlePickReaction(r.emoji)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    border: r.mine ? `1.5px solid ${accent}` : `1px solid ${panelBorder}`,
                    borderRadius: 20,
                    padding: "2px 6px",
                    background: panelBg,
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                  }}
                >
                  <span style={{ fontSize: 12.5 }}>{r.emoji}</span>
                  {r.count > 1 ? (
                    <span style={{ fontSize: 10.5, color: sub, fontWeight: 600 }}>{r.count}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hover action bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            opacity: hovered ? 1 : 0,
            transform: hovered ? "scale(1)" : "scale(0.9)",
            transition: "opacity 0.12s ease, transform 0.12s ease",
            pointerEvents: hovered ? "auto" : "none",
            position: "relative",
            marginLeft: isMine ? 0 : 2,
            marginRight: isMine ? 2 : 0,
          }}
        >
          <ActionIconButton
            label="React"
            dark={dark}
            onClick={() => setPickerOpen((v) => !v)}
          >
            <Smile size={15} />
          </ActionIconButton>
          <ActionIconButton label="Reply" dark={dark} onClick={() => onReply && onReply(msg)}>
            <Reply size={15} />
          </ActionIconButton>
          <ActionIconButton label="More" dark={dark} onClick={() => onForward && onForward(msg)}>
            <MoreHorizontal size={15} />
          </ActionIconButton>

          {pickerOpen && (
            <div
              ref={pickerRef}
              className="mb-picker-in"
              style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                [isMine ? "right" : "left"]: 0,
                display: "flex",
                gap: 2,
                background: panelBg,
                border: `1px solid ${panelBorder}`,
                borderRadius: 999,
                padding: "4px 6px",
                boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                zIndex: 5,
              }}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handlePickReaction(emoji)}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: 18,
                    cursor: "pointer",
                    padding: 3,
                    borderRadius: 999,
                    lineHeight: 1,
                  }}
                  className="mb-emoji-btn"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .mb-bubble-in { animation: mbBubbleIn 0.18s ease both; }
        .mb-reactions-in { animation: mbPopIn 0.16s ease both; }
        .mb-picker-in { animation: mbPickerIn 0.14s ease both; }
        .mb-emoji-btn { transition: transform 0.1s ease; }
        .mb-emoji-btn:hover { transform: scale(1.35); }
        @keyframes mbBubbleIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes mbPopIn { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
        @keyframes mbPickerIn { from { opacity: 0; transform: translateY(4px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .mb-bubble-in, .mb-reactions-in, .mb-picker-in, .mb-emoji-btn { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
};

const ActionIconButton = ({ children, label, dark, onClick }) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: "none",
        background: hover ? (dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)") : "transparent",
        color: dark ? "#AEBAC1" : "#54656F",
        width: 28,
        height: 28,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background 0.12s ease",
      }}
    >
      {children}
    </button>
  );
};

const DocumentLink = ({ url, linkStyle }) => {
  return (
    <a href={url} target="_blank" rel="noreferrer" style={linkStyle}>
      <span style={{ fontSize: 20 }}>📄</span>
      <span style={{ textDecoration: "underline" }}>Open document</span>
    </a>
  );
};

const StatusTick = ({ status, accent, sub }) => {
  if (status === "sending") return <Clock size={12} style={{ color: sub }} />;
  if (status === "failed") return null;
  if (status === "sent") return <Check size={15} style={{ color: sub }} />;
  if (status === "delivered") return <CheckCheck size={15} style={{ color: sub }} />;
  if (status === "read") return <CheckCheck size={15} style={{ color: "#53BDEB" }} />;
  return null;
};

export default MessageBubble;