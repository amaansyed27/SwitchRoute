from dataclasses import dataclass

from switchroute.auth.supabase import SupabaseAuthenticator
from switchroute.config import Settings
from switchroute.providers.registry import ProviderRegistry
from switchroute.routing.invoker import LiteLLMInvoker
from switchroute.routing.state import RoutingState
from switchroute.secrets.base import SecretStore
from switchroute.secrets.factory import build_secret_store
from switchroute.storage.contracts import Repository


@dataclass(slots=True)
class Services:
    settings: Settings
    repository: Repository
    secrets: SecretStore
    providers: ProviderRegistry
    invoker: LiteLLMInvoker
    user_auth: SupabaseAuthenticator
    routing_state: RoutingState


def build_services(settings: Settings, repository: Repository, routing_state: RoutingState) -> Services:
    providers = ProviderRegistry(settings.enable_test_provider)
    return Services(
        settings=settings,
        repository=repository,
        secrets=build_secret_store(settings),
        providers=providers,
        invoker=LiteLLMInvoker(providers, settings.enable_test_provider),
        user_auth=SupabaseAuthenticator(settings.supabase_url, settings.supabase_publishable_key),
        routing_state=routing_state,
    )
