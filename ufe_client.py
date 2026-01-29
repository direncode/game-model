"""
Undercurrent Flux Engine (UFE) API Client for Football Tactical Modeling

Synchronous client for interacting with the UFE latent space modeling API.
Domain: football
Input dimensions: 96 features
Friction terms: coherence_dev, fatigue_energy, overpress

Energy function: E = α×trajectory_deviation + β×undercurrent_friction + γ×self_prediction_error
"""

import httpx
from typing import List, Dict, Any, Optional


class UFEClient:
    """
    Synchronous client for the Undercurrent Flux Engine (UFE) API.

    Provides methods for encoding football tactical data into latent space,
    computing energy metrics, and predicting trajectories.

    Example:
        client = UFEClient()
        health = client.health()
        demo_data = client.demo("football")
        latent = client.encode(trajectory_data, "football")
        energy = client.energy(trajectory_data, "football")
        prediction = client.predict(latent, num_steps=10)
    """

    BASE_URL = "https://latentintegrator-j3ul23w91-direns-projects-6fcf4bec.vercel.app"
    DOMAIN = "football"
    INPUT_DIM = 96
    LATENT_DIM = 256
    FRICTION_TERMS = ["coherence_dev", "fatigue_energy", "overpress"]

    def __init__(
        self,
        base_url: str = "https://latentintegrator-j3ul23w91-direns-projects-6fcf4bec.vercel.app",
        timeout: float = 30.0
    ):
        """
        Initialize the UFE client.

        Args:
            base_url: Override the default API URL.
            timeout: Request timeout in seconds.
        """
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(timeout=timeout)

    def health(self) -> Dict[str, Any]:
        """
        Check API health status.

        Returns:
            Dict with status, latent_dim, and available domains.
        """
        response = self.client.get(f"{self.base_url}/api/health")
        response.raise_for_status()
        return response.json()

    def demo(self, domain: str) -> Dict[str, Any]:
        """
        Generate demo trajectory data for specified domain.

        Args:
            domain: The domain to generate demo data for (e.g., "football").

        Returns:
            Demo trajectory data from the API.
        """
        response = self.client.get(f"{self.base_url}/api/demo/{domain}")
        response.raise_for_status()
        return response.json()

    def encode(self, data: List, domain: str) -> Dict[str, Any]:
        """
        Encode trajectory data into latent space vectors.

        Args:
            data: Trajectory data as 3D array [batch, timesteps, features].
            domain: The domain for encoding (e.g., "football").

        Returns:
            Latent vectors (256-dimensional) from the encoder.
        """
        response = self.client.post(
            f"{self.base_url}/api/encode",
            json={"data": data, "domain": domain}
        )
        response.raise_for_status()
        return response.json()

    def energy(self, data: List, domain: str, weights: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Compute energy metrics for trajectory data.

        Energy function: E = α×trajectory_deviation + β×undercurrent_friction + γ×self_prediction_error

        Args:
            data: Trajectory data as 3D array [batch, timesteps, features].
            domain: The domain for energy computation.
            weights: Optional custom weights for energy terms.

        Returns:
            Dict containing total_energy, trajectory_deviation,
            undercurrent_friction, self_prediction_error, and friction_breakdown.
        """
        body = {"data": data, "domain": domain}
        if weights:
            body["weights"] = weights
        response = self.client.post(
            f"{self.base_url}/api/energy",
            json=body
        )
        response.raise_for_status()
        return response.json()

    def friction(self, latent: List, domain: str) -> Dict[str, Any]:
        """
        Compute friction terms from latent vectors.

        Args:
            latent: Latent vectors as 2D array [batch, 256 dimensions].
            domain: The domain for friction computation.

        Returns:
            Friction computation results from the API.
        """
        response = self.client.post(
            f"{self.base_url}/api/friction",
            json={"latent": latent, "domain": domain}
        )
        response.raise_for_status()
        return response.json()

    def predict(self, latent: List, num_steps: int = 10) -> Dict[str, Any]:
        """
        Predict future trajectory from latent vectors.

        Args:
            latent: Latent vectors as 2D array [batch, 256 dimensions].
            num_steps: Number of prediction steps (default: 10).

        Returns:
            Predicted trajectory data from the API.
        """
        response = self.client.post(
            f"{self.base_url}/api/predict",
            json={"latent": latent, "num_steps": num_steps}
        )
        response.raise_for_status()
        return response.json()

    def close(self):
        """Close the HTTP client."""
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


if __name__ == "__main__":
    # Quick test
    client = UFEClient()
    try:
        health = client.health()
        print(f"API Status: {health['status']}")
        print(f"Latent Dim: {health['latent_dim']}")
        print(f"Domains: {health['domains']}")
    finally:
        client.close()
