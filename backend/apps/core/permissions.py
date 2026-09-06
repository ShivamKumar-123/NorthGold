from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Staff-side endpoints — admin-app only."""

    message = "Admin access required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in ("admin", "superadmin"))


class IsSuperAdmin(BasePermission):
    message = "Super-admin access required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == "superadmin")


class IsVerifiedUser(BasePermission):
    """Money-moving user endpoints require a verified, active account."""

    message = "Account must be active and email-verified."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated
            and user.status == "active" and user.email_verified
        )
