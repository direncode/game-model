"""API v1 router — aggregates all sub-routers."""

from fastapi import APIRouter

from app.api.v1.admin import router as admin_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.auth import router as auth_router
from app.api.v1.challenges import router as challenges_router
from app.api.v1.connections import router as connections_router
from app.api.v1.crystallization import router as crystallization_router
from app.api.v1.datasets import router as datasets_router
from app.api.v1.embeddings import router as embeddings_router
from app.api.v1.lineage import router as lineage_router
from app.api.v1.modules import router as modules_router
from app.api.v1.reports import router as reports_router
from app.api.v1.fsd import router as fsd_router
from app.api.v1.btut import router as btut_router
from app.api.v1.hub import router as hub_router
from app.api.v1.latk import router as latk_router
from app.api.v1.data_layer import router as data_layer_router
from app.api.v1.dunc import router as dunc_router
from app.api.v1.tcd_vertical import router as tcd_vertical_router
from app.api.v1.ws import router as ws_router

router = APIRouter()

router.include_router(auth_router)
router.include_router(datasets_router)
router.include_router(crystallization_router)
router.include_router(modules_router)
router.include_router(connections_router)
router.include_router(challenges_router)
router.include_router(lineage_router)
router.include_router(reports_router)
router.include_router(embeddings_router)
router.include_router(admin_router)
router.include_router(alerts_router)
router.include_router(fsd_router)
router.include_router(btut_router)
router.include_router(latk_router)
router.include_router(data_layer_router)
router.include_router(hub_router)
router.include_router(dunc_router)
router.include_router(tcd_vertical_router, prefix="/tcd")
router.include_router(ws_router)

# Also export as api_router for alternate import style
api_router = router
