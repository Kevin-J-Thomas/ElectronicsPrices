from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.schedule_job import ScheduleJob
from app.schemas.schedule import ScheduleJobCreate, ScheduleJobRead, ScheduleJobUpdate

router = APIRouter(prefix="/schedule", dependencies=[Depends(require_admin)])


@router.get("", response_model=list[ScheduleJobRead])
def list_jobs(db: Session = Depends(get_db)):
    return db.query(ScheduleJob).order_by(ScheduleJob.name).all()


@router.post("", response_model=ScheduleJobRead, status_code=status.HTTP_201_CREATED)
def create_job(payload: ScheduleJobCreate, db: Session = Depends(get_db)):
    job = ScheduleJob(**payload.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    # TODO: register with APScheduler / Celery Beat
    return job


@router.get("/{job_id}", response_model=ScheduleJobRead)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(ScheduleJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.patch("/{job_id}", response_model=ScheduleJobRead)
def update_job(job_id: int, payload: ScheduleJobUpdate, db: Session = Depends(get_db)):
    job = db.get(ScheduleJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(job, key, value)
    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(ScheduleJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    db.delete(job)
    db.commit()
