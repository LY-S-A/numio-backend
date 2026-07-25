const Transaction = require("../models/Transaction");
const NumberOrder = require("../models/NumberOrder");

const capitalize = (text = "") =>
    text
        .toString()
        .split(" ")
        .map(
            (word) =>
                word.charAt(0).toUpperCase() +
                word.slice(1).toLowerCase()
        )
        .join(" ");

exports.getLiveActivities = async (req, res) => {
    try {
        // Latest successful deposits
        const deposits = await Transaction.find({
            type: "DEPOSIT",
            status: "SUCCESS",
        })
            .populate("user", "email")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        // Latest finished purchases
        const purchases = await NumberOrder.find({
            status: "FINISHED",
        })
            .populate("user", "email")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        const depositActivities = deposits.map((item) => ({
            type: "wallet",
            email: item.user?.email || "Unknown",
            action: `funded wallet with ₦${Number(item.amount).toLocaleString()}`,
            status: "SUCCESS",
            success: true,
            createdAt: item.createdAt,
        }));

        const purchaseActivities = purchases.map((item) => ({
            type: "purchase",
            email: item.user?.email || "Unknown",
            action: `purchased ${capitalize(item.country)} ${capitalize(item.service)} Number`,
            status: "SUCCESS",
            success: true,
            createdAt: item.createdAt,
        }));

        // Merge and sort newest first
        const activities = [...depositActivities, ...purchaseActivities]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 20);

        res.status(200).json(activities);
    } catch (err) {
        console.error("Live activity error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to load live activities.",
        });
    }
};

// DASHBOARD STATS
exports.getDashboardStats = async (req,res)=>{

try {

    const userId = req.user.id;


    const activeNumbers = await NumberOrder.countDocuments({
        user:userId,
        status:{
            $in:[
                "PENDING",
                "ACTIVE"
            ]
        }
    });


    const smsReceived = await NumberOrder.aggregate([
        {
            $match:{
                user:userId
            }
        },
        {
            $project:{
                totalSMS:{
                    $size:"$sms"
                }
            }
        },
        {
            $group:{
                _id:null,
                total:{
                    $sum:"$totalSMS"
                }
            }
        }
    ]);


    const totalSpent = await Transaction.aggregate([
        {
            $match:{
                user:userId,
                type:"PURCHASE",
                status:"SUCCESS"
            }
        },
        {
            $group:{
                _id:null,
                total:{
                    $sum:"$amount"
                }
            }
        }
    ]);


    const totalOrders = await NumberOrder.countDocuments({
        user:userId
    });



    res.json({

        success:true,

        stats:{
            activeNumbers,
            smsReceived:
                smsReceived[0]?.total || 0,

            totalSpent:
                totalSpent[0]?.total || 0,

            totalOrders
        }

    });



}catch(err){

    console.error(
        "Dashboard stats error:",
        err
    );


    res.status(500).json({
        success:false,
        message:"Failed to load dashboard stats"
    });

}

};
