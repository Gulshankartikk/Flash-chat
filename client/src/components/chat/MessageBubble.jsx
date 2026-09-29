import React, { useState } from 'react';
import { format } from 'date-fns';
import { Check, CheckCheck, MoreVertical, Edit2, Trash2, FileText, Download } from 'lucide-react';
import { Avatar } from '../common/Avatar';

export const MessageBubble = React.memo(function MessageBubble({
  message,
  isOwn,
  isGroup,
  onEdit,
  onDelete
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const formattedTime = message.createdAt
    ? format(new Date(message.createdAt), 'h:mm a')
    : '';

  const isRead = message.readBy && message.readBy.length > 1;
  const isDelivered = message.deliveredTo && message.deliveredTo.length > 1;

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (editContent.trim() && editContent !== message.content) {
      onEdit(message._id, editContent.trim());
    }
    setIsEditing(false);
  };

  if (message.isDeleted) {
    return (
      <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} my-1`}>
        <div className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 text-xs italic border border-slate-200/50 dark:border-slate-800">
          🚫 This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-end gap-2 my-1.5 group w-full ${
        isOwn ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isOwn && (
        <Avatar
          src={message.sender?.avatar}
          name={message.sender?.name}
          size="sm"
          className="mb-1"
        />
      )}

      <div className="relative max-w-[78%] md:max-w-[65%]">
        {/* Sender name for group chats */}
        {!isOwn && isGroup && (
          <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 ml-1 mb-1">
            {message.sender?.name}
          </p>
        )}

        <div
          className={`relative rounded-2xl px-4 py-2.5 shadow-sm text-sm break-words transition ${
            isOwn
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-xs'
              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-bl-xs'
          }`}
        >
          {/* Media Attachment Rendering */}
          {message.mediaUrl && (
            <div className="mb-2 rounded-lg overflow-hidden">
              {message.mediaType === 'image' ? (
                <a href={message.mediaUrl} target="_blank" rel="noreferrer">
                  <img
                    src={message.mediaUrl}
                    alt="attachment"
                    loading="lazy"
                    className="max-h-60 rounded-lg object-cover hover:opacity-95 transition"
                  />
                </a>
              ) : message.mediaType === 'audio' ? (
                <audio controls className="w-full max-w-xs mt-1">
                  <source src={message.mediaUrl} />
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <a
                  href={message.mediaUrl}
                  download={message.fileName || 'file'}
                  className={`flex items-center gap-2 p-2 rounded-lg ${
                    isOwn
                      ? 'bg-indigo-700/60 hover:bg-indigo-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100'
                  } transition`}
                >
                  <FileText className="w-5 h-5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">
                      {message.fileName || 'Attachment file'}
                    </p>
                    {message.fileSize ? (
                      <p className="text-[10px] opacity-75">
                        {Math.round(message.fileSize / 1024)} KB
                      </p>
                    ) : null}
                  </div>
                  <Download className="w-4 h-4 flex-shrink-0 opacity-75 hover:opacity-100" />
                </a>
              )}
            </div>
          )}

          {/* Text Content / Edit Input */}
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-1.5 min-w-[200px]">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                autoFocus
                className="px-2 py-1 text-slate-900 bg-white rounded border border-indigo-300 text-xs focus:outline-none"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-[11px] underline opacity-90 hover:opacity-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-[11px] bg-white text-indigo-700 px-2 py-0.5 rounded font-semibold"
                >
                  Save
                </button>
              </div>
            </form>
          ) : (
            message.content && <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
          )}

          {/* Footer Metadata: Timestamp, Edited tag, Read Receipts */}
          <div
            className={`flex items-center justify-end gap-1 mt-1 text-[10px] select-none ${
              isOwn ? 'text-indigo-200' : 'text-slate-400'
            }`}
          >
            {message.isEdited && <span className="italic mr-0.5">(edited)</span>}
            <span>{formattedTime}</span>

            {isOwn && (
              <span className="flex items-center ml-0.5" title={isRead ? 'Read' : isDelivered ? 'Delivered' : 'Sent'}>
                {isRead ? (
                  <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                ) : isDelivered ? (
                  <CheckCheck className="w-3.5 h-3.5 opacity-80" />
                ) : (
                  <Check className="w-3.5 h-3.5 opacity-75" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Message Actions Menu (Edit / Delete) */}
        {isOwn && !isEditing && (
          <div className="absolute top-1 right-[-24px] opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {showMenu && (
                <div
                  className="absolute right-0 top-6 z-20 w-28 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 py-1 text-xs"
                  onClick={() => setShowMenu(false)}
                >
                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(message._id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 text-left"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
