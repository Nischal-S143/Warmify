# Placeholder directory for trained quantile model artifacts.
# After running scripts/train_model.py, copy the .pkl files here
# before `sam build && sam deploy`.
#
# Expected files:
#   model_q50.pkl  — GradientBoostingRegressor(loss='quantile', alpha=0.50)
#   model_q90.pkl  — GradientBoostingRegressor(loss='quantile', alpha=0.90)
#   model_q95.pkl  — GradientBoostingRegressor(loss='quantile', alpha=0.95)
