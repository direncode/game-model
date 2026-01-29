"""
Undercurrent Flux Engine (UFE) API Client for Football Tactical Modeling

Async client for interacting with the UFE latent space modeling API.
Domain: football
Input dimensions: 96 features
Friction terms: coherence_dev, fatigue_energy, overpress

Energy function: E = α×trajectory_deviation + β×undercurrent_friction + γ×self_prediction_error
"""

import httpx
from typing import Any
from dataclasses import dataclass


@dataclass
class EnergyResponse:
    """Energy computation response from UFE API."""
    total_energy: float
    trajectory_deviation: float
    undercurrent_friction: float
    friction_breakdown: dict[str, float]


@dataclass
class HealthResponse:
    """Health check response from UFE API."""
    status: str
    latent_dim: int
    domains: list[str]


class UFEClient:
    """
    Async client for the Undercurrent Flux Engine (UFE) API.

    Provides methods for encoding football tactical data into latent space,
    computing energy metrics, and predicting trajectories.

    Example:
        async with UFEClient() as client:
            health = await client.health()
            demo_data = await client.demo()
            latent = await client.encode(trajectory_data)
            energy = await client.energy(trajectory_data)
            prediction = await client.predict(latent, steps=10)
    """

    BASE_URL = "https://latentintegrator-j3ul23w91-direns-projects-6fcf4bec.vercel.app"
    DOMAIN = "football"
    INPUT_DIM = 96
    LATENT_DIM = 256
    FRICTION_TERMS = ["coherence_dev", "fatigue_energy", "overpress"]

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float = 30.0,
        domain: str | None = None
    ):
        """
        Initialize the UFE client.

        Args:
            base_url: Override the default API URL.
            timeout: Request timeout in seconds.
            domain: Override the default domain (football).
        """
        self.base_url = (base_url or self.BASE_URL).rstrip("/")
        self.timeout = timeout
        self.domain = domain or self.DOMAIN
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "UFEClient":
        """Enter async context manager."""
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            headers={"Content-Type": "application/json"}
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Exit async context manager."""
        if self._client:
            await self._client.aclose()
            self._client = None

    def _get_client(self) -> httpx.AsyncClient:
        """Get the HTTP client, creating one if needed."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout,
                headers={"Content-Type": "application/json"}
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def health(self) -> HealthResponse:
        """
        Check API health status.

        Returns:
            HealthResponse with status, latent_dim, and available domains.

        Raises:
            httpx.HTTPStatusError: If the request fails.
        """
        client = self._get_client()
        response = await client.get("/api/health")
        response.raise_for_status()
        data = response.json()
        return HealthResponse(
            status=data["status"],
            latent_dim=data["latent_dim"],
            domains=data["domains"]
        )

    async def demo(self) -> dict[str, Any]:
        """
        Generate demo trajectory data for football domain.

        Returns:
            Demo trajectory data from the API.

        Raises:
            httpx.HTTPStatusError: If the request fails.
        """
        client = self._get_client()
        response = await client.get(f"/api/demo/{self.domain}")
        response.raise_for_status()
        return response.json()

    async def encode(self, data: list[list[list[float]]]) -> dict[str, Any]:
        """
        Encode trajectory data into latent space vectors.

        Args:
            data: Trajectory data as 3D array [batch, timesteps, 96 features].

        Returns:
            Latent vectors (256-dimensional) from the encoder.

        Raises:
            httpx.HTTPStatusError: If the request fails.
            ValueError: If input dimensions are invalid.
        """
        if data and data[0] and len(data[0][0]) != self.INPUT_DIM:
            raise ValueError(
                f"Expected {self.INPUT_DIM} features per timestep, "
                f"got {len(data[0][0])}"
            )

        client = self._get_client()
        response = await client.post(
            "/api/encode",
            json={"data": data, "domain": self.domain}
        )
        response.raise_for_status()
        return response.json()

    async def energy(self, data: list[list[list[float]]]) -> EnergyResponse:
        """
        Compute energy metrics for trajectory data.

        Energy function: E = α×trajectory_deviation + β×undercurrent_friction + γ×self_prediction_error

        Args:
            data: Trajectory data as 3D array [batch, timesteps, 96 features].

        Returns:
            EnergyResponse containing total_energy, trajectory_deviation,
            undercurrent_friction, and friction_breakdown with terms:
            coherence_dev, fatigue_energy, overpress.

        Raises:
            httpx.HTTPStatusError: If the request fails.
        """
        if data and data[0] and len(data[0][0]) != self.INPUT_DIM:
            raise ValueError(
                f"Expected {self.INPUT_DIM} features per timestep, "
                f"got {len(data[0][0])}"
            )

        client = self._get_client()
        response = await client.post(
            "/api/energy",
            json={"data": data, "domain": self.domain}
        )
        response.raise_for_status()
        data = response.json()
        return EnergyResponse(
            total_energy=data["total_energy"],
            trajectory_deviation=data["trajectory_deviation"],
            undercurrent_friction=data["undercurrent_friction"],
            friction_breakdown=data["friction_breakdown"]
        )

    async def friction(self, latent: list[list[float]]) -> dict[str, Any]:
        """
        Compute friction terms from latent vectors.

        Args:
            latent: Latent vectors as 2D array [batch, 256 dimensions].

        Returns:
            Friction computation results from the API.

        Raises:
            httpx.HTTPStatusError: If the request fails.
            ValueError: If latent dimensions are invalid.
        """
        if latent and len(latent[0]) != self.LATENT_DIM:
            raise ValueError(
                f"Expected {self.LATENT_DIM}-dimensional latent vectors, "
                f"got {len(latent[0])}"
            )

        client = self._get_client()
        response = await client.post(
            "/api/friction",
            json={"latent": latent, "domain": self.domain}
        )
        response.raise_for_status()
        return response.json()

    async def predict(
        self,
        latent: list[list[float]],
        steps: int = 10
    ) -> dict[str, Any]:
        """
        Predict future trajectory from latent vectors.

        Args:
            latent: Latent vectors as 2D array [batch, 256 dimensions].
            steps: Number of prediction steps (default: 10).

        Returns:
            Predicted trajectory data from the API.

        Raises:
            httpx.HTTPStatusError: If the request fails.
            ValueError: If latent dimensions are invalid.
        """
        if latent and len(latent[0]) != self.LATENT_DIM:
            raise ValueError(
                f"Expected {self.LATENT_DIM}-dimensional latent vectors, "
                f"got {len(latent[0])}"
            )

        client = self._get_client()
        response = await client.post(
            "/api/predict",
            json={"latent": latent, "num_steps": steps}
        )
        response.raise_for_status()
        return response.json()


async def main():
    """Example usage of the UFE client."""
    async with UFEClient() as client:
        # Check health
        health = await client.health()
        print(f"API Status: {health.status}")
        print(f"Latent dimensions: {health.latent_dim}")
        print(f"Available domains: {health.domains}")

        # Get demo data
        demo = await client.demo()
        print(f"\nDemo data keys: {list(demo.keys())}")

        # If demo contains trajectory data, encode and analyze
        if "data" in demo:
            trajectory = demo["data"]

            # Encode to latent space
            encoded = await client.encode(trajectory)
            print(f"\nEncoded latent shape: {len(encoded.get('latent', []))} vectors")

            # Compute energy
            energy = await client.energy(trajectory)
            print(f"\nEnergy metrics:")
            print(f"  Total energy: {energy.total_energy:.4f}")
            print(f"  Trajectory deviation: {energy.trajectory_deviation:.4f}")
            print(f"  Undercurrent friction: {energy.undercurrent_friction:.4f}")
            print(f"  Friction breakdown:")
            for term, value in energy.friction_breakdown.items():
                print(f"    {term}: {value:.4f}")

            # Predict future trajectory
            if "latent" in encoded:
                prediction = await client.predict(encoded["latent"], steps=10)
                print(f"\nPrediction keys: {list(prediction.keys())}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
