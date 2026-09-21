from app.models import User
async def get_total_users():
    
   total = await User.find({"is_deleted": False}).count()
   return {
      "total_users": total, 
   }

async def get_average_age():
    
   total_users = await User.find({"is_deleted": False}).to_list()
   total_age = 0
   for age in total_users:
      total_age = total_age + age.age

   average_age = total_age / len(total_users)
   return {
      "average_age": average_age, 
   }

async def get_top_cities():
    cursor = User.get_pymongo_collection().aggregate(
        [
            {"$group": {"_id": "$city", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$project": {"_id": 0, "city": "$_id", "count": 1}}
        ]
    )
    results = await cursor.to_list(length=None)
    
    return {"cities": results}