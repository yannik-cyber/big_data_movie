from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import IntegerType, StringType, StructType, TimestampType
import mysqlx

dbOptions = {"host": "my-app-mysql-service", 'port': 33060, "user": "root", "password": "mysecretpw"}
dbSchema = 'popular'
windowDuration = '5 minutes'
slidingDuration = '1 minute'


# Create a spark session
spark = SparkSession.builder \
    .appName("Structured Streaming").getOrCreate()

# Set log level
spark.sparkContext.setLogLevel('WARN')


# Read messages from Kafka
kafkaMessages = spark \
    .readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers",
            "my-cluster-kafka-bootstrap:9092") \
    .option("subscribe", "tracking-data") \
    .option("startingOffsets", "earliest") \
    .load()

# Define schema of tracking data

trackingMessageSchema = StructType() \
    .add("movie_name", StringType()) \
    .add("timestamp", IntegerType())


# Convert value: binary -> JSON -> fields + parsed timestamp
trackingMessages = kafkaMessages.select(
    # Extract 'value' from Kafka message (i.e., the tracking data)
    from_json(
        column("value").cast("string"),
        trackingMessageSchema
    ).alias("json")
).select(
    # Convert Unix timestamp to TimestampType
    from_unixtime(column('json.timestamp'))
    .cast(TimestampType())
    .alias("parsed_timestamp"),

    # Select all JSON fields
    column("json.*")
) \
    .withColumnRenamed('json.movie_name', 'movie_name') \
    .withWatermark("parsed_timestamp", windowDuration)


# Compute most favourite slides
favourite = trackingMessages.groupBy(
    window(
        column("parsed_timestamp"),
        windowDuration,
        slidingDuration
    ),
    column("movie_name")
).count().withColumnRenamed('count', 'views')


# Start running the query; print running counts to the console
consoleDump = favourite \
    .writeStream \
    .trigger(processingTime=slidingDuration) \
    .outputMode("update") \
    .format("console") \
    .option("truncate", "false") \
    .start()

# Example Part 6


def saveToDatabase(batchDataframe, batchId):
    # Define function to save a dataframe to mysql
    def save_to_db(iterator):
        # Connect to database and use schema
        session = mysqlx.get_session(dbOptions)
        session.sql("USE favourite").execute()

        for row in iterator:
            # Run upsert (insert or update existing)
            sql = session.sql("INSERT INTO favourite "
                              "(movie_name, count) VALUES (?, ?) "
                              "ON DUPLICATE KEY UPDATE count=?")
            sql.bind(row.movie_name, row.views, row.views).execute()

        session.close()

    # Perform batch UPSERTS per data partition
    batchDataframe.foreachPartition(save_to_db)

# Example Part 7


dbInsertStream = favourite.writeStream \
    .trigger(processingTime=slidingDuration) \
    .outputMode("update") \
    .foreachBatch(saveToDatabase) \
    .start()

# Wait for termination
spark.streams.awaitAnyTermination()

