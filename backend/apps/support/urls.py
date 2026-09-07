from django.urls import path

from .views import (
    AdminThreadListView, AdminThreadView, MessageReactionView, MessageStarView,
    MessageView, MyThreadView, MyUnreadCountView,
)

urlpatterns = [
    path("messages/", MyThreadView.as_view(), name="support-thread"),
    path("messages/unread/", MyUnreadCountView.as_view(), name="support-unread"),

    # Shared by both sides — the rule is "may I see this thread?", which is the
    # same question whoever is asking.
    path("messages/<uuid:message_id>/", MessageView.as_view(), name="support-message"),
    path("messages/<uuid:message_id>/react/", MessageReactionView.as_view(), name="support-react"),
    path("messages/<uuid:message_id>/star/", MessageStarView.as_view(), name="support-star"),

    path("admin/threads/", AdminThreadListView.as_view(), name="admin-support-threads"),
    path("admin/threads/<uuid:user_id>/", AdminThreadView.as_view(), name="admin-support-thread"),
]
