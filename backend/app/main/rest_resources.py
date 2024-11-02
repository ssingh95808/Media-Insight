import os
import json
import logging
import random
from flask import request
from flask_restful import Resource
from config import Config
from bson.objectid import ObjectId
from confluent_kafka import Producer
from app import db


basedir = os.path.abspath(os.path.dirname(__file__))
upload_path = os.path.join(basedir, '../../static/descriptions_images')

logger = logging.getLogger(__name__)


def save_to_mongodb(collection_name, data):
    collection = db[collection_name]
    result = collection.insert_one(data)
    return str(result.inserted_id)

def get_task_from_mongodb(collection_name, _id):
    collection = db[collection_name]
    result = collection.find_one({'_id': ObjectId(_id)})
    return result

def send_to_kafka(topic, message):
    topic_types = [Text2Image.kafka_topic, GenerateDescription.kafka_topic, GenerateText.kafka_topic]
    if topic not in topic_types:
        raise ValueError(f"Invalid topic type. Must be one of: {topic_types}")
    message['task_type'] = topic
    message = json.dumps(message).encode('utf-8')
    producer = Producer({'bootstrap.servers': Config.KAFKA_BOOTSTRAP_SERVERS})
    producer.produce(topic, message, callback=delivery_report)
    producer.flush()

def delivery_report(err, msg):
    """ Called once for each message produced to indicate delivery result.
        Triggered by poll() or flush(). """
    if err is not None:
        print('Message delivery failed: {}'.format(err))
    else:
        print('Message delivered to {} [{}]'.format(msg.topic(), msg.partition()))


class Text2Image(Resource):
    kafka_topic = 'text2image'
    collection_name = kafka_topic

    def get(self, id=None):
        try:
            ret = get_task_from_mongodb(self.collection_name, id)
            ret.pop('_id', None)
        except Exception as e:
            logger.exception(str(e))
            return {'task_id': id, 'data': {}, 'msg': 'Task not found'}, 404
        
        if 'image' in ret:
            ret['image'] = f"/api/v1/static/images/{ret['image']}"
        return {
            'task_id': id,
            'data': ret
        }

    def post(self):
        try:
            # get prompt text from request
            text = request.json['text']
            task_id = save_to_mongodb('text2image', {'text': text})
            # publish task to Kafka topic: text2image
            send_to_kafka(self.kafka_topic, {'task_id': task_id, 'text': text})
            return {'task_id': task_id}, 201
        except Exception as error:
            return {'error': str(error)}, 400


class GenerateDescription(Resource):
    kafka_topic = 'generate-description'
    collection_name = kafka_topic

    def get(self, id=None):
        try:
            ret = get_task_from_mongodb(self.collection_name, id)
            ret.pop('_id', None)
        except Exception as e:
            logger.exception(str(e))
            return {'task_id': id, 'data': {}, 'msg': 'Task not found'}, 404
        
        return {
            'task_id': id,
            'data': ret
        }

    def post(self):
        try:
            file = request.files['image']
            # get file extension
            _, file_extension = os.path.splitext(file.filename)
            if not file_extension:
                file_extension = '.png'
            # Save result to MongoDB
            task_id = save_to_mongodb(self.collection_name, {'caption': '', 'ext': file_extension})
            
            file.save(f"{upload_path}/{task_id}{file_extension}")
            send_to_kafka(self.kafka_topic, {'task_id': task_id, 'ext': file_extension})
            
            return {'task_id': task_id}, 201
        except Exception as error:
            return {'error': str(error)}, 400

# Helper function to generate captions using BLIP model
def generate_caption(image_path):
    image = Image.open(image_path).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")
    
    with torch.no_grad():
        outputs = blip_model.generate(
            **inputs,
            max_length=20,
            num_beams=5,
            repetition_penalty=2.0
        )
    
    caption = processor.decode(outputs[0], skip_special_tokens=True)
    return caption

class GenerateText(Resource):
    kafka_topic = 'generate-text'
    collection_name = kafka_topic

    def get(self, id=None):
        return {'task_id': id }
    
    def post(self):
        try:
            return {'task_id': random.randint(1, 10)}, 201
        except Exception as error:
            return {'error': str(error)}, 400
