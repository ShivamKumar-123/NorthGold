from django.urls import path

from .views import (
    AdminMessageView, AdminThreadListView, AdminThreadView, MyMessageView,
    MyThreadView, MyUnreadCountView,
)

urlpatterns = [
    path("messages/", MyThreadView.as_view(), name="support-thread"),
    path("messages/unread/", MyUnreadCountView.as_view(), name="support-unread"),
    path("messages/<uuid:message_id>/", MyMessageView.as_view(), name="support-message"),

    path("admin/threads/", AdminThreadListView.as_view(), name="admin-support-threads"),
    path("admin/threads/<uuid:user_id>/", AdminThreadView.as_view(), name="admin-support-thread"),
    path("admin/messages/<uuid:message_id>/", AdminMessageView.as_view(), name="admin-support-message"),
]
